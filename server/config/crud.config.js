// Central config for all CRUD models
const crudConfigs = {
  awx: {
    table: 'AnsibleForms.awx',
    fields: [
      { name: 'id', isKey: true },
      { name: 'name', isNaturalKey: true, required: true },
      { name: 'description' },
      { name: 'is_default', isBoolean: true },
      { name: 'uri', required: true },
      { name: 'use_credentials', isBoolean: true },
      { name: 'username', setDefault: true },
      { name: 'password', isEncrypted: true, setDefault: true },
      { name: 'token', isEncrypted: true, setDefault: true },
      { name: 'ignore_certs', isBoolean: true },
      { name: 'ca_bundle' }
    ],
    allowCache: true,
    cacheTTL: 3600
  },
  oauth2: {
    table: 'AnsibleForms.oauth2_providers',
    fields: [
      { name: 'id', isKey: true },
      { name: 'provider', required: true },
      { name: 'name', isNaturalKey: true, required: true },
      { name: 'description' },
      { name: 'issuer' },
      { name: 'tenant_id'},
      { name: 'client_id', required: true },
      { name: 'client_secret', isEncrypted: true, required: true },
      { name: 'enable', isBoolean: true },
      { name: 'groupfilter' },
      { name: 'redirect_uri' },
      { name: 'scope' },
      { name: 'auth_url' },
      { name: 'token_url' },
      { name: 'userinfo_url' },
      { name: 'extra' }
    ],
    allowCache: false
  },
  credential: {
    table: 'AnsibleForms.credentials',
    fields: [
      { name: 'id', isKey: true },
      { name: 'name', isNaturalKey: true, required: true },
      { name: 'user', required: true },
      { name: 'password', isEncrypted: true, required: true },
      { name: 'host', required: true },
      { name: 'port', required: true },
      { name: 'db_name' },
      { name: 'secure', isBoolean: true },
      { name: 'is_database', isBoolean: true, setDefault: true },
      { name: 'description' },
      { name: 'db_type' }
    ],
    allowCache: true,
    cacheTTL: 3600
  },
  datasource: {
    table: 'AnsibleForms.datasource',
    fields: [
      { name: 'id', isKey: true },
      { name: 'name', isNaturalKey: true, required: true },
      { name: 'schema', required: true },
      { name: 'extra_vars' },
      { name: 'form' },
      { name: 'cron' },
      { name: 'output' },
      { name: 'status' },
      { name: 'state' },
      { name: 'last_run' },
      { name: 'queue_id' }
    ],
    allowCache: true,
    cacheTTL: 3600
  },
  datasource_schemas: {
    table: 'AnsibleForms.datasource_schemas',
    fields: [
      { name: 'id', isKey: true },
      { name: 'name', isNaturalKey: true, required: true },
      { name: 'description' },
      { name: 'table_definitions' },
      { name: 'output' },
      { name: 'status' },
      { name: 'path' }
    ],
    allowCache: true,
    cacheTTL: 3600
  },
  groups: {
    table: 'AnsibleForms.groups',
    fields: [
      { name: 'id', isKey: true },
      { name: 'name', isNaturalKey: true, required: true }
    ],
    allowCache: true,
    cacheTTL: 3600
  },
  ldap: {
    table: 'AnsibleForms.ldap',
    fields: [
      { name: 'id', isKey: true },
      { name: 'server', required: true },
      { name: 'port', required: true },
      { name: 'ignore_certs', isBoolean: true },
      { name: 'enable_tls', isBoolean: true },
      { name: 'cert' },
      { name: 'ca_bundle' },
      { name: 'bind_user_dn', required: true },
      { name: 'bind_user_pw', isEncrypted: true, required: true },
      { name: 'search_base', required: true },
      { name: 'username_attribute', required: true },
      { name: 'groups_attribute' },
      { name: 'enable', isBoolean: true },
      { name: 'is_advanced', isBoolean: true },
      { name: 'groups_search_base' },
      { name: 'group_class' },
      { name: 'group_member_attribute' },
      { name: 'group_member_user_attribute' },
      { name: 'mail_attribute' }
    ],
    allowCache: false
  },
  schedule: {
    table: 'AnsibleForms.schedule',
    fields: [
      { name: 'id', isKey: true },
      { name: 'name', isNaturalKey: true, required: true },
      { name: 'extra_vars' },
      { name: 'form' },
      { name: 'cron' },
      { name: 'output' },
      { name: 'status' },
      { name: 'state' },
      { name: 'last_run' },
      { name: 'queue_id' }
    ],
    allowCache: true,
    cacheTTL: 3600
  }
};

export default crudConfigs;
