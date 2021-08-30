module.exports = {
  secret: process.env.ACCESS_TOKEN_SECRET,
  jwtExpiration: process.env.ACCESS_TOKEN_EXPIRATION,
  jwtRefreshExpiration: process.env.ACCESS_TOKEN_REFRESH_EXPIRATION,
  jwtStore: {},
  ldapServer:process.env.LDAP_SERVER,
  ldapBindUserDn:process.env.LDAP_BIND_USER_DN,
  ldapBindUserPassword:process.env.LDAP_BIND_USER_PASSWORD,
  ldapSearchBase:process.env.LDAP_SEARCH_BASE,
  ldapUsernameAttribute:process.env.LDAP_USERNAME_ATTRIBUTE,
  ldapErrorRegex:".*, data ([^,]*),.*",
  ldapErrors:{
    "52e":"Wrong password",
    "525":"User not found",
    "530":"Not permitted to logon at this time",
    "532":"Password expired",
    "533":"Account disabled",
    "701":"Account expired",
    "773":"User must reset password",
    "775":"Account locked"
  }
};
