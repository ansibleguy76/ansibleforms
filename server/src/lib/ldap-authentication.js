const assert = require('assert')
const ldap = require('ldapjs')

// convert a SearchResultEntry object in ldapjs 3.0
// to a user object to maintain backward compatibility

// added by Mirko for 5.0.1 => ü in results
function unescapeLdapResult(ldapResult) {
  // Regular expression to match the escaped sequences
  const regex = /\\([0-9a-fA-F]{2})\\([0-9a-fA-F]{2})/g;

  // Replace each escaped sequence with its Unicode character
  return ldapResult.replace(regex, (match, p1, p2) => {
      // Convert the hex codes to a Buffer
      const bytes = Buffer.from([parseInt(p1, 16), parseInt(p2, 16)]);
      // Convert the Buffer to a UTF-8 String
      return bytes.toString('utf8');
  });
}

function _searchResultToUser(pojo) {
  assert(pojo.type == 'SearchResultEntry')
  let user = { dn: pojo.objectName }
  pojo.attributes.forEach((attribute) => {
    user[attribute.type] =
      attribute.values.length == 1 ? attribute.values[0] : attribute.values
  })
  return user
}
// bind and return the ldap client
function _ldapBind(dn, password, starttls, ldapOpts) {
  return new Promise(function (resolve, reject) {
    ldapOpts.connectTimeout = ldapOpts.connectTimeout || 5000
    var client = ldap.createClient(ldapOpts)

    client.on('connect', function () {
      if (starttls) {
        client.starttls(ldapOpts.tlsOptions, null, function (error) {
          if (error) {
            reject(error)
            return
          }
          client.bind(dn, password, function (err) {
            if (err) {
              reject(err)
              client.unbind()
              return
            }
            ldapOpts.log && ldapOpts.log.trace('bind success!')
            resolve(client)
          })
        })
      } else {
        client.bind(dn, password, function (err) {
          if (err) {
            reject(err)
            client.unbind()
            return
          }
          ldapOpts.log && ldapOpts.log.trace('bind success!')
          resolve(client)
        })
      }
    })

    //Fix for issue https://github.com/shaozi/ldap-authentication/issues/13
    client.on('timeout', (err) => {
      reject(err)
    })
    client.on('connectTimeout', (err) => {
      reject(err)
    })
    client.on('error', (err) => {
      reject(err)
    })

    client.on('connectError', function (error) {
      if (error) {
        reject(error)
        return
      }
    })
  })
}

// search a user and return the object
async function _searchUser(
  ldapClient,
  searchBase,
  usernameAttribute,
  username,
  attributes = null
) {
  return new Promise(function (resolve, reject) {
    var filter = new ldap.filters.EqualityFilter({
      attribute: usernameAttribute,
      value: username,
    })
    let searchOptions = {
      filter: filter,
      scope: 'sub',
      attributes: attributes
    }
    if (attributes) {
      searchOptions.attributes = attributes
    }
    ldapClient.search(searchBase, searchOptions, function (err, res) {
      var user = null
      if (err) {
        reject(err)
        ldapClient.unbind()
        return
      }
      res.on('searchEntry', function (entry) {
        user = _searchResultToUser(entry.pojo)
      })
      res.on('searchReference', function (referral) {
        // TODO: we don't support reference yet
        // If the server was able to locate the entry referred to by the baseObject
        // but could not search one or more non-local entries,
        // the server may return one or more SearchResultReference messages,
        // each containing a reference to another set of servers for continuing the operation.
        // referral.uris
      })
      res.on('error', function (err) {
        reject(err)
        ldapClient.unbind()
      })
      res.on('end', function (result) {
        if (result.status != 0) {
          reject(new Error('ldap search status is not 0, search failed'))
        } else {
          resolve(user)
        }
        ldapClient.unbind()
      })
    })
  })
}

// search a groups which user is member
async function _searchUserGroups(
  ldapClient,
  searchBase,
  user,
  groupClass,
  groupMemberAttribute = 'member',
  groupMemberUserAttribute = 'dn'
) {
  return new Promise(function (resolve, reject) {
    ldapClient.search(
      searchBase,
      {
        filter: `(&(objectclass=${groupClass})(${groupMemberAttribute}=${user[groupMemberUserAttribute]}))`,
        scope: 'sub',
      },
      function (err, res) {
        var groups = []
        if (err) {
          reject(err)
          ldapClient.unbind()
          return
        }
        res.on('searchEntry', function (entry) {
          groups.push(entry.pojo)
        })
        res.on('searchReference', function (referral) {})
        res.on('error', function (err) {
          reject(err)
          ldapClient.unbind()
        })
        res.on('end', function (result) {
          if (result.status != 0) {
            reject(new Error('ldap search status is not 0, search failed'))
          } else {
            resolve(groups)
          }
          ldapClient.unbind()
        })
      }
    )
  })
}

async function authenticateWithAdmin(
  adminDn,
  adminPassword,
  userSearchBase,
  usernameAttribute,
  username,
  userPassword,
  starttls,
  ldapOpts,
  groupsSearchBase,
  groupClass,
  groupMemberAttribute = 'member',
  groupMemberUserAttribute = 'dn',
  attributes = null
) {
  var ldapAdminClient
  try {
    ldapAdminClient = await _ldapBind(
      adminDn,
      adminPassword,
      starttls,
      ldapOpts
    )
  } catch (error) {
    throw { admin: error }
  }
  var user = await _searchUser(
    ldapAdminClient,
    userSearchBase,
    usernameAttribute,
    username,
    attributes
  )
  ldapAdminClient.unbind()
  if (!user || !user.dn) {
    ldapOpts.log &&
      ldapOpts.log.trace(
        `admin did not find user! (${usernameAttribute}=${username})`
      )
    throw new LdapAuthenticationError(
      'user not found or usernameAttribute is wrong'
    )
  }
  var userDn = user.dn
  userDn = unescapeLdapResult(userDn)
  let ldapUserClient
  try {
    ldapUserClient = await _ldapBind(userDn, userPassword, starttls, ldapOpts)
  } catch (error) {
    throw error
  }
  ldapUserClient.unbind()
  if (groupsSearchBase && groupClass && groupMemberAttribute) {
    try {
      ldapAdminClient = await _ldapBind(
        adminDn,
        adminPassword,
        starttls,
        ldapOpts
      )
    } catch (error) {
      throw error
    }
    var groups = await _searchUserGroups(
      ldapAdminClient,
      groupsSearchBase,
      user,
      groupClass,
      groupMemberAttribute,
      groupMemberUserAttribute
    )
    user.groups = groups
    ldapAdminClient.unbind()
  }
  return user
}

async function authenticateWithUser(
  userDn,
  userSearchBase,
  usernameAttribute,
  username,
  userPassword,
  starttls,
  ldapOpts,
  groupsSearchBase,
  groupClass,
  groupMemberAttribute = 'member',
  groupMemberUserAttribute = 'dn',
  attributes = null
) {
  let ldapUserClient
  try {
    ldapUserClient = await _ldapBind(userDn, userPassword, starttls, ldapOpts)
  } catch (error) {
    throw error
  }
  if (!usernameAttribute || !userSearchBase) {
    // if usernameAttribute is not provided, no user detail is needed.
    ldapUserClient.unbind()
    return true
  }
  var user = await _searchUser(
    ldapUserClient,
    userSearchBase,
    usernameAttribute,
    username,
    attributes
  )
  if (!user || !user.dn) {
    ldapOpts.log &&
      ldapOpts.log.trace(
        `user logged in, but user details could not be found. (${usernameAttribute}=${username}). Probabaly wrong attribute or searchBase?`
      )
    throw new LdapAuthenticationError(
      'user logged in, but user details could not be found. Probabaly usernameAttribute or userSearchBase is wrong?'
    )
  }
  ldapUserClient.unbind()
  if (groupsSearchBase && groupClass && groupMemberAttribute) {
    try {
      ldapUserClient = await _ldapBind(userDn, userPassword, starttls, ldapOpts)
    } catch (error) {
      throw error
    }
    var groups = await _searchUserGroups(
      ldapUserClient,
      groupsSearchBase,
      user,
      groupClass,
      groupMemberAttribute,
      groupMemberUserAttribute
    )
    user.groups = groups
    ldapUserClient.unbind()
  }
  return user
}

async function verifyUserExists(
  adminDn,
  adminPassword,
  userSearchBase,
  usernameAttribute,
  username,
  starttls,
  ldapOpts,
  groupsSearchBase,
  groupClass,
  groupMemberAttribute = 'member',
  groupMemberUserAttribute = 'dn',
  attributes = null
) {
  var ldapAdminClient
  try {
    ldapAdminClient = await _ldapBind(
      adminDn,
      adminPassword,
      starttls,
      ldapOpts
    )
  } catch (error) {
    throw { admin: error }
  }
  var user = await _searchUser(
    ldapAdminClient,
    userSearchBase,
    usernameAttribute,
    username,
    attributes
  )
  ldapAdminClient.unbind()
  if (!user || !user.dn) {
    ldapOpts.log &&
      ldapOpts.log.trace(
        `admin did not find user! (${usernameAttribute}=${username})`
      )
    throw new LdapAuthenticationError(
      'user not found or usernameAttribute is wrong'
    )
  }
  if (groupsSearchBase && groupClass && groupMemberAttribute) {
    try {
      ldapAdminClient = await _ldapBind(
        adminDn,
        adminPassword,
        starttls,
        ldapOpts
      )
    } catch (error) {
      throw error
    }
    var groups = await _searchUserGroups(
      ldapAdminClient,
      groupsSearchBase,
      user,
      groupClass,
      groupMemberAttribute,
      groupMemberUserAttribute
    )
    user.groups = groups
    ldapAdminClient.unbind()
  }
  return user
}

async function authenticate(options) {
  if (!options.userDn) {
    assert(options.adminDn, 'Admin mode adminDn must be provided')
    assert(options.adminPassword, 'Admin mode adminPassword must be provided')
    assert(options.userSearchBase, 'Admin mode userSearchBase must be provided')
    assert(
      options.usernameAttribute,
      'Admin mode usernameAttribute must be provided'
    )
    assert(options.username, 'Admin mode username must be provided')
  } else {
    assert(options.userDn, 'User mode userDn must be provided')
  }
  assert(
    options.ldapOpts && options.ldapOpts.url,
    'ldapOpts.url must be provided'
  )
  if (options.verifyUserExists) {
    assert(options.adminDn, 'Admin mode adminDn must be provided')
    assert(
      options.adminPassword,
      'adminDn and adminPassword must be both provided.'
    )
    return await verifyUserExists(
      options.adminDn,
      options.adminPassword,
      options.userSearchBase,
      options.usernameAttribute,
      options.username,
      options.starttls,
      options.ldapOpts,
      options.groupsSearchBase,
      options.groupClass,
      options.groupMemberAttribute,
      options.groupMemberUserAttribute
    )
  }
  assert(options.userPassword, 'userPassword must be provided')
  if (options.adminDn) {
    assert(
      options.adminPassword,
      'adminDn and adminPassword must be both provided.'
    )
    return await authenticateWithAdmin(
      options.adminDn,
      options.adminPassword,
      options.userSearchBase,
      options.usernameAttribute,
      options.username,
      options.userPassword,
      options.starttls,
      options.ldapOpts,
      options.groupsSearchBase,
      options.groupClass,
      options.groupMemberAttribute,
      options.groupMemberUserAttribute,
      options.attributes
    )
  }
  assert(options.userDn, 'adminDn/adminPassword OR userDn must be provided')
  return await authenticateWithUser(
    options.userDn,
    options.userSearchBase,
    options.usernameAttribute,
    options.username,
    options.userPassword,
    options.starttls,
    options.ldapOpts,
    options.groupsSearchBase,
    options.groupClass,
    options.groupMemberAttribute,
    options.groupMemberUserAttribute,
    options.attributes
  )
}

class LdapAuthenticationError extends Error {
  constructor(message) {
    super(message)
    // Ensure the name of this error is the same as the class name
    this.name = this.constructor.name
    // This clips the constructor invocation from the stack trace.
    // It's not absolutely essential, but it does make the stack trace a little nicer.
    //  @see Node.js reference (bottom)
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports.authenticate = authenticate
module.exports.LdapAuthenticationError = LdapAuthenticationError