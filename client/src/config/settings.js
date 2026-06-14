// These settings define the gui admin pages
// Accepts a t() function from vue-i18n for translations

export default function getSettings(t) {
  return {
    users: {
        type: 'user',
        route: 'users',
        label: t('settings.users.label'),
        icon: 'user',
        selectable: false,
        actions: [
            { name: 'edit', title: t('settings.users.editUser'), icon: 'pencil', color: 'edit' },
            { name: 'delete', title: t('settings.users.deleteUser'), icon: 'trash', color: 'delete' },
            { name: 'change_password', title: t('settings.common.changePassword'), icon: 'lock', color: 'change' }
        ],
        fields: [
            { key: 'id', label: t('settings.fields.id'), sortable: false, required: false, filterable: false, noInput: true, hidden: true, icon: 'key'},
            { key: 'username', label: t('settings.fields.username'), sortable: true, required: true, filterable: true, icon: "user" },
            { key: 'password', label: t('settings.fields.password'), type: "password", sortable: false, required: true, filterable: false, hidden: true, icon: "lock" },
            { key: 'email', label: t('settings.fields.email'), type: "email", sortable: false, required: false, filterable: false, icon: "lock" },
            { key: 'group_id', label: t('settings.fields.group'), type: "select", sortable: false, required: true, filterable: false, icon: "users", parent: 'group', values: 'group', valueKey: 'id', labelKey: 'name' }
        ]
    },
    groups:{
        type: 'group',
        label: t('settings.groups.label'),
        icon: 'users',
        selectable: false,
        children: [{
            type: 'user',
            label: t('settings.users.label'),
            labelPlural: t('settings.users.labelPlural'),
            icon: 'user',
            key: 'group_id'
        }],
        actions: [
            { name: 'delete', title: t('settings.groups.deleteGroup'), icon: 'trash', color: 'delete' }
        ],
        fields: [
            { key: 'id', label: t('settings.fields.id'), sortable: false, required: false, filterable: false, noInput: true, hidden: true, icon: 'key' },
            { key: 'name', label: t('settings.fields.name'), sortable: true, required: true, filterable: true, icon: "users" }
        ], 
        childFields: {
            user: [
                { key: 'username', label: t('settings.fields.username') },
                { key: 'email', label: t('settings.fields.email') },
                { key: 'group_id', label: t('settings.fields.group'), hidden: true }
            ]
        }
    },
    repositories:{
        type: "repository",
        label: t('settings.repositories.label'),
        labelPlural: t('settings.repositories.labelPlural'),
        // reloadSeconds: 7,
        icon: "fab,git",
        idKey: "name",
        selectable: false,
        actions: [
            { name: "edit", icon: "pencil", title: t('settings.repositories.editRepository'), color: "edit" },
            { name: "delete", icon: "trash", title: t('settings.repositories.deleteRepository'), color: "delete" },
            { name: "change_password", icon: "lock", title: t('settings.common.changePassword'), color: "change" },
            { name: "trigger", icon: "play", title: t('settings.common.trigger'), color: "test" },
            { name: "preview", icon: "info-circle", title: t('settings.common.showOutput'), color: "preview" },
            { name: "reset", icon: "redo", title: t('settings.repositories.resetRepository'), color: "refresh" },
            { name: "sync", icon: "upload", title: t('settings.repositories.syncRepository'), color: "test", dependency: ["use_for_forms", "use_for_config"] }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "output", hidden: true, noInput: true },
            { key: "name", icon: "heading", label: t('settings.fields.name'), placeholder: "my_repo_name", readonly: false, required: true, help: t('settings.repositories.helpName') },
            { key: "branch", icon: "code-branch", label: t('settings.fields.branch'), placeholder: "main", readonly: false },
            { key: "head", label: t('settings.fields.head'), noInput: true },
            { key: "status", label: t('settings.fields.status'), noInput: true },
            { key: "user", icon: "user", label: t('settings.fields.username'), placeholder: "my-user",  hidden: true },
            { key: "password", icon: "lock", label: t('settings.fields.password'), type: "password", placeholder: t('settings.repositories.placeholderPassword'), hidden: true },
            { key: "uri", icon: "fab,git", label: t('settings.fields.uri'), placeholder: "https://github.com/account/repo.git", required: true, hidden: true, help: t('settings.repositories.helpUri') },
            { key: "cron", icon: "stopwatch", label: t('settings.fields.cronSchedule'), help: t('settings.fields.cronHelp'), hidden: true, regex: { expression: "^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$", description: t('settings.fields.cronRegexDescription')} },
            { key: "description", icon: "info-circle", label: t('settings.fields.description'), placeholder: t('settings.fields.description'), required: true },
            { key: "use_for_config", type: "checkbox", label: t('settings.repositories.useForConfig'), help: t('settings.repositories.helpUseForConfig'), hidden: true },
            { key: "use_for_forms", type: "checkbox", label: t('settings.repositories.useForForms'), help: t('settings.repositories.helpUseForForms'), hidden: true },
            { key: "use_for_playbooks", type: "checkbox", label: t('settings.repositories.useForPlaybooks'), help: t('settings.repositories.helpUseForPlaybooks'), hidden: true },
            { key: "use_for_vars_files", type: "checkbox", label: t('settings.repositories.useForVarsFiles'), help: t('settings.repositories.helpUseForVarsFiles'), hidden: true },
            { key: "rebase_on_start", type: "checkbox", label: t('settings.repositories.cloneOnStart'), help: t('settings.repositories.helpCloneOnStart'), hidden: true }
        ]
    },
    oauth2_providers: {
        type: 'oauth2',
        route: 'oauth2',
        label: t('settings.oauth2.label'),
        labelPlural: t('settings.oauth2.labelPlural'),
        icon: 'key',
        selectable: false,
        actions: [
            { name: 'edit', title: t('settings.oauth2.editProvider'), icon: 'pencil', color: 'edit' },
            { name: 'delete', title: t('settings.oauth2.deleteProvider'), icon: 'trash', color: 'delete' },
            { name: 'change_password', title: t('settings.common.changePassword'), icon: 'lock', color: 'change' },
        ],
        fields: [
            { key: 'enable', label: t('settings.fields.enable'), type: 'checkbox', isAction: true },
            { key: 'provider', label: t('settings.oauth2.provider'), required: true, icon: 'cloud', type: 'select', parent: 'providers', values: [{ label: 'Entra ID', value: 'azuread'},{label: 'Open ID',value:'oidc'}] , valueKey: 'value', labelKey: 'label'},
            { key: 'name', label: t('settings.fields.name'), required: true, icon: 'heading' },
            { key: 'description', label: t('settings.fields.description'), required: false, icon: 'info-circle' },
            { key: 'tenant_id', label: t('settings.oauth2.tenantId'), required: false, icon: 'building', dependency: 'provider', dependencyValues: ['azuread'], hidden: true, help: t('settings.oauth2.tenantIdHelp') },
            { key: 'client_id', label: t('settings.oauth2.clientId'), required: true, icon: 'key', dependency: 'provider', dependencyValues: ['azuread', 'oidc'], hidden: true },
            { key: 'issuer', label: t('settings.oauth2.issuer'), required: true, icon: 'globe', dependency: 'provider', dependencyValues: ['oidc'], hidden: true },
            { key: 'redirect_uri', label: t('settings.oauth2.redirectUrl'), readonly: false, dependency: 'provider',dependencyValues: ['azuread', 'oidc'], defaultMap: {
                  azuread: (config) => `${config.url}/api/v2/auth/azureadoauth2/callback`,
                  oidc: (config) => `${config.url}/api/v2/auth/oidc/callback`
                }, hidden: true
            },
            { key: 'client_secret', label: t('settings.oauth2.clientSecret'), type: 'password', required: true, icon: 'lock', hidden: true },
            { key: 'groupfilter', label: t('settings.oauth2.groupFilter'), required: false, icon: 'filter', hidden: true },
            { key: 'redirect_uri', label: t('settings.oauth2.redirectUri'), required: false, icon: 'link', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'scope', label: t('settings.oauth2.scope'), required: false, icon: 'list', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'auth_url', label: t('settings.oauth2.authUrl'), required: false, icon: 'globe', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'token_url', label: t('settings.oauth2.tokenUrl'), required: false, icon: 'globe', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'userinfo_url', label: t('settings.oauth2.userinfoUrl'), required: false, icon: 'globe', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'extra', label: t('settings.oauth2.extra'), type: 'textarea', required: false, icon: 'code', dependency: 'provider', dependencyValues: [''], hidden: true }
        ]

    },    
    dataSchemas:{
        type: "datasource/schema",
        label: t('settings.dataSchemas.label'),
        labelPlural: t('settings.dataSchemas.labelPlural'),
        // reloadSeconds: 7,
        icon: "database",
        actions: [
            { name: "edit", icon: "pencil", title: t('settings.dataSchemas.editSchema'), color: "edit" },
            { name: "delete", icon: "trash", title: t('settings.dataSchemas.deleteSchema'), color: "delete" },
            { name: "reset", icon: "redo", title: t('settings.dataSchemas.resetSchema'), color: "refresh" },
            { name: "preview", icon: "info-circle", title: t('settings.common.showOutput'), color: "preview" }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "output", hidden: true, noInput: true },
            { key: "force", type: "checkbox", label: t('settings.dataSchemas.force'), hidden: true },
            { key: "name", icon: "heading", label: t('settings.fields.name'), placeholder: t('settings.dataSchemas.placeholderName'), readonly: false, required: true, help: t('settings.repositories.helpName') },
            { key: "status", label: t('settings.fields.status'), noInput: true },
            { key: "description", icon: "info-circle", label: t('settings.fields.description'), placeholder: t('settings.fields.description'), required: false },
            { key: "table_definitions", type: "editor", label: t('settings.dataSchemas.tableDefinitions'), hidden: true, lang:"yaml", style:"width: 100%;height: 40vh;font-size:1rem" }
        ]
    },    
    datasources:{
        type: "datasource",
        label: t('settings.datasources.label'),
        labelPlural: t('settings.datasources.labelPlural'),
        // reloadSeconds: 7,
        icon: "file-import",
        actions: [
            { name: "edit", icon: "pencil", title: t('settings.datasources.editDatasource'), color: "edit" },
            { name: "delete", icon: "trash", title: t('settings.datasources.deleteDatasource'), color: "delete" },
            { name: "trigger", icon: "file-import", title: t('settings.datasources.importDatasource'), color: "refresh" },
            { name: "preview", icon: "info-circle", title: t('settings.common.showOutput'), color: "preview" }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "output", hidden: true, noInput: true },
            { key: "name", icon: "heading", label: t('settings.fields.name'), placeholder: t('settings.datasources.placeholderName'), readonly: false, required: true, help: t('settings.repositories.helpName') },
            { key: "schema", icon: "database", label: t('settings.datasources.schema'), type: "select", readonly: false, required: true, parent: "schemas" , values: 'datasource/schema', valueKey: 'name', labelKey: 'name', hidden: true },
            { key: "cron", icon: "stopwatch", label: t('settings.fields.cronSchedule'), help: t('settings.fields.cronHelp'), hidden: true, regex: { expression: "^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$", description: t('settings.fields.cronRegexDescription')} },
            { key: "form", icon: "play", label: t('settings.fields.form'), placeholder: t('settings.datasources.placeholderForm'), readonly: false, required: true, hidden: true},
            { key: "status", label: t('settings.fields.status'), noInput: true },
            { key: "state", label: t('settings.fields.state'), noInput: true },
            { key: "last_run", label: t('settings.fields.lastRun'), noInput: true },
            { key: "extra_vars", type: "editor", label: t('settings.fields.extraVars'), hidden: true, lang:"yaml", style:"width: 100%;height: 40vh;font-size:1rem", help: t('settings.datasources.extraVarsHelp') }
        ]
    },    
    schedules:{
        type: "schedule",
        label: t('settings.schedules.label'),
        labelPlural: t('settings.schedules.labelPlural'),
        // reloadSeconds: 7,
        icon: "clock",
        selectable: false,
        noCreate: true,
        actions: [
            { name: "edit", icon: "pencil", title: t('settings.schedules.editSchedule'), color: "edit" },
            { name: "delete", icon: "trash", title: t('settings.schedules.deleteSchedule'), color: "delete" },
            { name: "trigger", icon: "play", title: t('settings.schedules.runSchedule'), color: "refresh" },
            { name: "preview", icon: "info-circle", title: t('settings.common.showOutput'), color: "preview" }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "output", hidden: true, noInput: true },
            { key: "name", icon: "heading", label: t('settings.fields.name'), placeholder: t('settings.schedules.placeholderName'), readonly: false, required: true, help: t('settings.repositories.helpName') },
            { key: "one_time_run", label: t('settings.schedules.oneTimeRun'), type: "checkbox", placeholder: t('settings.schedules.oneTimeRunPlaceholder'), required: false, hidden: true },
            { key: "cron", icon: "stopwatch", label: t('settings.fields.cronSchedule'), help: t('settings.fields.cronHelp'), required: false, regex: { expression: "^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$", description: t('settings.fields.cronRegexDescription')}, negateDependency: true, dependency: "one_time_run" },
            { key: "run_at", icon: "calendar", label: t('settings.schedules.runAt'), type: "datetime", convertToUtc: true, help: t('settings.schedules.runAtHelp'), required: false, dependency: "one_time_run" },
            { key: "form", icon: "play", label: t('settings.fields.form'), placeholder: t('settings.datasources.placeholderForm'), readonly: false, required: true, hidden: true},
            { key: "status", label: t('settings.fields.status'), noInput: true },
            { key: "state", label: t('settings.fields.state'), noInput: true },
            { key: "last_run", label: t('settings.fields.lastRun'), type: "datetime", noInput: true },
            { key: "extra_vars", type: "editor", label: t('settings.fields.extraVars'), hidden: true, lang:"yaml", style:"width: 100%;height: 40vh;font-size:1rem", help: t('settings.schedules.extraVarsHelp') }
        ]
    },
    stored_jobs:{
        type: "stored-jobs",
        label: t('settings.storedJobs.label'),
        labelPlural: t('settings.storedJobs.labelPlural'),
        icon: "floppy-disk",
        reloadSeconds: false, // Disable auto-reload
        noCreate: true,
        actions: [
            { name: "preview", icon: "eye", title: t('settings.storedJobs.viewDetails'), color: "preview" },
            { name: "delete", icon: "trash", title: t('settings.storedJobs.deleteJob'), color: "delete" }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "name", icon: "heading", label: t('settings.fields.name') },
            { key: "description", icon: "info-circle", label: t('settings.fields.description') },
            { key: "form_name", icon: "play", label: t('settings.fields.form') },
            { key: "username", icon: "user", label: t('settings.storedJobs.userTypeName') },
            { key: "form_data", hidden: true },
            { key: "created_at", icon: "calendar", label: t('settings.fields.createdAt'), type: "datetime" },
            { key: "expires_at", icon: "calendar", label: t('settings.fields.expiresAt'), type: "datetime" }
        ]
    },            
    knownhosts:{
        type: 'knownhosts',
        label: t('settings.knownhosts.label'),
        removeDoubles: true, // remove double entries
        flat: true, // flat data structure,
        icon: 'fab,git',
        actions: [
            { name: 'preview', title: t('settings.knownhosts.showEntry'), icon: 'info-circle', color: 'change' },
            { name: 'delete', title: t('settings.knownhosts.deleteEntry'), icon: 'trash', color: 'delete' }
        ],
        fields: [
            { key: 'id', label: t('settings.knownhosts.hostEntry'), filterable: true, hidden:true, noInput: true },
            { key: 'name', label: t('settings.knownhosts.hostEntry'), required: false, filterable: true, noInput: true },
            { key: 'host', label: t('settings.fields.host'), required: true, filterable: true, hidden:true }
        ]
    },
    credentials: {
        type: 'credential',
        label: t('settings.credentials.label'),
        icon: 'lock',
        selectable: false,
        actions: [
            { name: 'edit', title: t('settings.credentials.editCredential'), icon: 'pencil', color: 'edit' },
            { name: 'delete', title: t('settings.credentials.deleteCredential'), icon: 'trash', color: 'delete' },
            { name: 'change_password', title: t('settings.common.changePassword'), icon: 'lock', color: 'change' },
            { name: 'test', title: t('settings.common.testConnection'), icon: 'plug', color: 'test', dependency: "is_database" }
        ],
        fields: [
            { key: 'id', label: t('settings.fields.id'), sortable: false, required: false, filterable: false, noInput: true, hidden: true, icon: 'key', noInput: true },
            { key: 'is_database', label: t('settings.credentials.forDatabase'), type: 'checkbox', hidden: true, placeholder: t('settings.credentials.enableDbFields'), required: false },
            { key: 'name', label: t('settings.fields.name'), sortable: true, required: true, filterable: true, icon: "lock", isKey: true },
            { key: 'user', label: t('settings.fields.user'), sortable: true, required: false, filterable: true, icon: "user" },
            { key: 'password', label: t('settings.fields.password'), type: "password", sortable: false, required: false, filterable: false, icon: "lock", hidden: true },
            { key: 'vault_path', label: t('settings.credentials.vaultPath'), placeholder: t('settings.credentials.vaultPathPlaceholder'), help: t('settings.credentials.vaultPathHelp'), sortable: false, required: false, filterable: false, icon: "shield-alt", hidden: true },
            { key: 'host', label: t('settings.fields.host'), sortable: true, required: false, filterable: true, icon: "server" },
            { key: 'port', label: t('settings.fields.port'), type:"number", sortable: true, required: false, filterable: false, icon: "arrows-alt-v" },
            { key: 'description', label: t('settings.fields.description'), sortable: false, hidden: true, required: true, filterable: false, icon: "info-circle" },
            {
                key: 'db_type', label: t('settings.credentials.databaseType'), type: 'select', sortable: false, hidden: true, required: true, parent:'databases',
                values: [
                    { value: 'mysql',    label: 'MySQL'},
                    { value: 'mssql',    label: 'MSSQL' },
                    { value: 'postgres', label: 'PostgreSQL' },
                    { value: 'oracle',   label: 'Oracle' },
                    { value: 'mongodb',  label: 'MongoDB' },
                ],
                labelKey: "label", valueKey: "value",
                filterable: true, icon: "database", dependency: "is_database"
            },
            { key: 'db_name', label: t('settings.credentials.database'), sortable: false, hidden: true, required: false, filterable: false, icon: "database", dependency: "is_database" }

        ]
    },
    ssh:{
        label: t('settings.ssh.label'),
        type: "sshkey",
        icon: "key",
        fields: [
            { key: "art", label: t('settings.ssh.privateKeyArt'), type: "sshPrivateKeyArt", line: 0 },
            { key: "key", label: t('settings.ssh.privateKey'), help: t('settings.ssh.privateKeyHelp'), type: "textarea",placeholder:"-----BEGIN RSA PRIVATE KEY-----", line: 1, required: true },
            { key: "publicKey", label: t('settings.ssh.publicKey'), type: "sshPublicKey", line: 2 }
        ]
    },
    ldap: {
        type: "ldap",
        label: t('settings.ldap.label'),
        icon: "globe",
        actions: [
            { name: 'test', title: t('settings.common.testConnection'), icon: 'plug', dependency: "enable" }
        ],    
        fields: [
            { key: "enable", label: t('settings.ldap.enableLdap'), type: "checkbox", isAction: true },
            { key: "is_advanced", label: t('settings.ldap.advanced'), type: "checkbox", dependency: "enable", isAction: true },
            { key: "enable_tls", label: t('settings.ldap.enableTls'), type: "checkbox", dependency: "enable", isAction: true },
            { key: "ignore_certs", label: t('settings.ldap.ignoreCerts'), type: "checkbox", dependency: "enable_tls", isAction: true },        
            { key: "server", icon:"server", line: 0, label: t('settings.fields.server'), required: true, dependency: "enable" },
            { key: "port", icon:"arrows-alt-v", type:"number", line: 0, label: t('settings.fields.port'), required: true, dependency: "enable" },
            { key: "search_base", icon:"search", line: 1, label: t('settings.ldap.searchBase'), required: true, dependency: "enable" },
            { key: "mail_attribute", icon:"envelope", line: 1, label: t('settings.ldap.mailAttribute'), required: true, dependency: "enable" },
            { key: "bind_user_dn", icon:"user", line: 2, label: t('settings.ldap.bindUserDn'), required: true, dependency: "enable" },
            { key: "bind_user_pw", icon:"lock", line: 2, label: t('settings.ldap.bindUserPassword'), type: "password", required: true, dependency: "enable" },
            { key: "username_attribute", icon:"image-portrait", line: 3, label: t('settings.ldap.usernameAttribute'), required: true, dependency: "enable" },
            { key: "groups_attribute", icon:"users", line: 3, label: t('settings.ldap.groupsAttribute'), required: true, dependency: "enable" },
            { key: "groups_search_base", icon:"users-viewfinder", line: 4, label: t('settings.ldap.groupsSearchBase'), required: false, dependency: "is_advanced" },
            { key: "group_class", icon:"users-rectangle", line: 4, label: t('settings.ldap.groupClass'), required: false, dependency: "is_advanced" },
            { key: "group_member_attribute", icon:"users-line", line: 5, label: t('settings.ldap.groupMemberAttribute'), required: false, dependency: "is_advanced" },
            { key: "group_member_user_attribute", icon:"user-group", line: 5, label: t('settings.ldap.groupMemberUserAttribute'), required: false, dependency: "is_advanced" },
            { key: "cert", icon:"certificate", type:"textarea", line: 6, label: t('settings.fields.certificate'), required: true, dependency: "ignore_certs", negateDependency: true, placeholder:"-----BEGIN CERTIFICATE-----" },
            { key: "ca_bundle", icon:"certificate",type:"textarea", line: 6, label: t('settings.fields.caBundle'), required: true, dependency: "ignore_certs", negateDependency: true, placeholder:"-----BEGIN CERTIFICATE-----" },
        ]
    },
    aap:{
        type: "awx",
        label: t('settings.aap.label'),
        icon: "fac,ansible",
        selectable: false,
        actions: [
            { name: 'edit', title: t('settings.aap.editCredential'), icon: 'pencil', color: 'edit' },
            { name: 'delete', title: t('settings.aap.deleteCredential'), icon: 'trash', color: 'delete' },
            { name: 'change_password', title: t('settings.common.changePassword'), icon: 'lock', color: 'change' },
            { name: 'test', title: t('settings.common.testConnection'), icon: 'plug', color: 'test' }
        ],
        fields: [
            { key: 'id', label: t('settings.fields.id'), sortable: false, required: false, filterable: false, noInput: true, hidden: true, icon: 'key', noInput: true },            
            { key: "use_credentials", label: t('settings.aap.useCredentials'), type: "checkbox", isAction: true, hidden: true, password_related: true },
            { key: "ignore_certs", label: t('settings.ldap.ignoreCerts'), type: "checkbox", isAction: true, hidden: true },
            { key: "is_default", label: t('settings.aap.isDefault'), type: "checkbox", isAction: true },
            { key: "name", icon: "heading", line: 0, label: t('settings.fields.name'), required: true },
            { key: "description", icon: "info-circle", line: 0, label: t('settings.fields.description'), required: false },
            { key: "uri", icon: "globe", line: 0, label: t('settings.fields.uri'), required: true },
            { key: "username", icon: "user", line: 2, label: t('settings.fields.username'), required: true, dependency: "use_credentials", hidden: true },
            { key: "password", icon: "lock", line: 2, label: t('settings.fields.password'), type: "password", required: true, dependency: "use_credentials", hidden: true },
            { key: "token", icon: "lock", line: 1, label: t('settings.fields.token'), type: "password", required: true, dependency: "use_credentials", negateDependency: true, hidden: true },
            { key: "ca_bundle", icon: "certificate", type: "textarea", line: 6, label: t('settings.fields.caBundle'), required: true, dependency: "ignore_certs", negateDependency: true, placeholder: "-----BEGIN CERTIFICATE-----", hidden: true },
        ],
    },
    mailSettings:{
        icon: "envelope",
        type: "settings",
        label: t('settings.mail.label'),
        actions: [
            { name: "test", icon: "envelope", title: t('settings.mail.testMail') }
        ],
        fields: [
            { key: "mail_secure", icon: "lock", label: t('settings.mail.useTls'), type: "checkbox", required: false, isAction: true },
            { key: "mail_server", icon: "server", line: 0, label: t('settings.mail.mailServer'), required: true },
            { key: "mail_port", type:"number", icon: "arrows-alt-v", line: 0, label: t('settings.mail.mailPort'), required: true },
            { key: "mail_username", icon: "user", line: 1, label: t('settings.mail.mailUsername'), required: false },
            { key: "mail_password", icon: "key", type: "password", line: 1, label: t('settings.mail.mailPassword'), required: false },
            { key: "mail_from", icon: "envelope", type: "email", line: 2, label: t('settings.mail.mailFrom'), required: true },

        ]
    },
    backups: {
        icon: 'database',
        type: 'backup',
        label: t('settings.backups.label'),
        labelPlural: t('settings.backups.labelPlural'),
        idKey: 'folder',
        actions: [
            { name: 'preview', title: t('settings.backups.showBackup'), icon: 'info-circle', color: 'change' },
            { name: 'trigger', icon: 'undo', title: t('settings.backups.restore'), color: 'warning' },
            { name: 'delete', icon: 'trash', title: t('common.delete'), color: 'danger' }
        ],
        fields: [
            { key: 'folder', label: t('settings.backups.folder'), noInput: true },
            { key: 'date', label: t('settings.fields.date'), type: "datetime" , noInput: true },
            { key: 'description', label: t('settings.fields.description'), type: 'text' }
        ]
    },
  }
}
