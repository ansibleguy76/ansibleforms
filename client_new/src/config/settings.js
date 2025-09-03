// i need to return a dictionary of settings

export default {
    users: {
        type: 'user',
        route: 'users',
        label: 'User',
        icon: 'user',
        actions: [
            { name: 'edit', title: `Edit Group`, icon: 'pencil', color: 'edit' },
            { name: 'delete', title: `Delete Group`, icon: 'trash', color: 'delete' },
            { name: 'change_password', title: `Change Password`, icon: 'lock', color: 'change' }
        ],
        fields: [
            { key: 'id', label: 'ID', sortable: false, required: false, filterable: false, noInput: true, hidden: true, icon: 'key'},
            { key: 'username',  label: 'Username', sortable: true, required: true, filterable: true, icon: "user" },
            { key: 'password',  label: 'Password', type: "password", sortable: false, required: true, filterable: false, hidden: true, icon: "lock" },
            { key: 'email', label: 'Email', type: "email", sortable: false, required: false, filterable: false, icon: "lock" },
            { key: 'group_id', label: 'Group', type: "select", sortable: false, required: true, filterable: false, icon: "users", parent: 'group', values: 'group', valueKey: 'id', labelKey: 'name' }
        ]
    },
    groups:{
        type: 'group',
        label: 'Group',
        icon: 'users',
        children: [{
            type: 'user',
            label: 'User',
            labelPlural: 'Users',
            icon: 'user',
            key: 'group_id'
        }],
        actions: [
            { name: 'select', title: `Show Group`, icon: 'info-circle', color: 'change' },
            { name: 'delete', title: `Delete Group`, icon: 'trash', color: 'delete' }
        ],
        fields: [
            { key: 'id', label: 'ID', sortable: false, required: false, filterable: false, noInput: true, hidden: true, icon: 'key' },
            { key: 'name', label: 'Name', sortable: true, required: true, filterable: true, icon: "users" }
        ], 
        childFields: {
            user: [
                { key: 'username', label: 'Username' },
                { key: 'email', label: 'Email' },
                { key: 'group_id', label: 'Group', hidden: true }
            ]
        }
    },
    repositories:{
        type: "repository",
        label: "Repository",
        labelPlural: "Repositories",
        // reloadSeconds: 7,
        icon: "fab,git",
        idKey: "name",
        actions: [
            { name: "edit", icon: "pencil", title: "Edit Repository", color: "edit" },
            { name: "delete", icon: "trash", title: "Delete Repository", color: "delete" },
            { name: "change_password", icon: "lock", title: "Change Password", color: "change" },
            { name: "trigger", icon: "play", title: "Trigger", color: "test" },
            { name: "preview", icon: "info-circle", title: "Show output", color: "preview" },
            { name: "reset", icon: "redo", title: "Reset Repository", color: "refresh" }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "output", hidden: true, noInput: true },
            { key: "name", icon: "heading", label: "Name", placeholder: "my_repo_name", readonly: false, required: true, help: "Alphanumeric with dash and underscore" },
            { key: "branch", icon: "code-branch", label: "Branch", placeholder: "main", readonly: false },
            { key: "head", label: "Head", noInput: true },
            { key: "status", label: "Status", noInput: true },
            { key: "user", icon: "user", label: "Username", placeholder: "my-user",  hidden: true },
            { key: "password", icon: "lock", label: "Password", type: "password", required: true, placeholder: "Password or Token", hidden: true },
            { key: "uri", icon: "fab,git", label: "Uri", placeholder: "https://github.com/account/repo.git", required: true, hidden: true, help: "Only ssh or https uri's are allowed" },
            { key: "cron", icon: "stopwatch", label: "Cron Schedule", help: "Minute Hour DayOfMonth Month DayOfWeek - For example : */5 * L * 1,3L", hidden: true, regex: { expression: "^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$", description: "Must be a valid cron schedule"} },
            { key: "description", icon: "info-circle", label: "Description", placeholder: "Description", required: true },
            { key: "use_for_forms", type: "checkbox", label: "Use for forms ?", hidden: true },
            { key: "use_for_playbooks", type: "checkbox", label: "Use for playbooks ?", hidden: true },
            { key: "rebase_on_start", type: "checkbox", label: "Clone on app start ?", hidden: true }
        ]
    },
    oauth2_providers: {
        type: 'oauth2',
        route: 'oauth2',
        label: 'OAuth2 Provider',
        labelPlural: 'OAuth2 Providers',
        icon: 'key',
        actions: [
            { name: 'edit', title: `Edit Provider`, icon: 'pencil', color: 'edit' },
            { name: 'delete', title: `Delete Provider`, icon: 'trash', color: 'delete' },
            { name: 'change_password', title: `Change Password`, icon: 'lock', color: 'change' },
        ],
        fields: [
            { key: 'enable', label: 'Enable', type: 'checkbox', isAction: true },
            { key: 'provider', label: 'Provider', required: true, icon: 'cloud', type: 'select', parent: 'providers', values: [{ label: 'Entra ID', value: 'azuread'},{label: 'Open ID',value:'oidc'}] , valueKey: 'value', labelKey: 'label'},
            { key: 'name', label: 'Name', required: true, icon: 'heading' },
            { key: 'description', label: 'Description', required: false, icon: 'info-circle' },
            { key: 'client_id', label: 'Client ID', required: true, icon: 'key', dependency: 'provider', dependencyValues: ['azuread', 'oidc'], hidden: true },
            { key: 'issuer', label: 'Issuer', required: true, icon: 'globe', dependency: 'provider', dependencyValues: ['oidc'], hidden: true },
            { key: 'redirect_uri', label: 'Redirect URL', readonly: false, dependency: 'provider',dependencyValues: ['azuread', 'oidc'], defaultMap: {
                  azuread: (config) => `${config.url}/api/v1/auth/azureadoauth2/callback`,
                  oidc: (config) => `${config.url}/api/v1/auth/oidc/callback`
                }, hidden: true
            },
            { key: 'client_secret', label: 'Client Secret', type: 'password', required: true, icon: 'lock', hidden: true },
            { key: 'groupfilter', label: 'Group Filter', required: false, icon: 'filter', hidden: true },
            { key: 'redirect_uri', label: 'Redirect URI', required: false, icon: 'link', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'scope', label: 'Scope', required: false, icon: 'list', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'auth_url', label: 'Auth URL', required: false, icon: 'globe', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'token_url', label: 'Token URL', required: false, icon: 'globe', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'userinfo_url', label: 'Userinfo URL', required: false, icon: 'globe', dependency: 'provider', dependencyValues: [''], hidden: true },
            { key: 'extra', label: 'Extra (JSON)', type: 'textarea', required: false, icon: 'code', dependency: 'provider', dependencyValues: [''], hidden: true }
        ]

    },    
    dataSchemas:{
        type: "datasource/schema",
        label: "Datasource Schema",
        labelPlural: "Datasource Schemas",
        // reloadSeconds: 7,
        icon: "database",
        actions: [
            { name: "edit", icon: "pencil", title: "Edit Datasource Schema", color: "edit" },
            { name: "delete", icon: "trash", title: "Delete Datasource Schema", color: "delete" },
            { name: "reset", icon: "redo", title: "Reset Datasource Schema", color: "refresh" },
            { name: "preview", icon: "info-circle", title: "Show output", color: "preview" }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "output", hidden: true, noInput: true },
            { key: "force", type: "checkbox", label: "Force ?", hidden: true },
            { key: "name", icon: "heading", label: "Name", placeholder: "schema name", readonly: false, required: true, help: "Alphanumeric with dash and underscore" },
            { key: "status", label: "Status", noInput: true },
            { key: "description", icon: "info-circle", label: "Description", placeholder: "Description", required: false },
            { key: "table_definitions", type: "editor", label: "Table Definitions", hidden: true, lang:"yaml", style:"width: 100%;height: 40vh;font-size:1rem" }
        ]
    },    
    datasources:{
        type: "datasource",
        label: "Datasource",
        labelPlural: "Datasources",
        // reloadSeconds: 7,
        icon: "file-import",
        actions: [
            { name: "edit", icon: "pencil", title: "Edit Datasource", color: "edit" },
            { name: "delete", icon: "trash", title: "Delete Datasource", color: "delete" },
            { name: "trigger", icon: "file-import", title: "Import Datasource", color: "refresh" },
            { name: "preview", icon: "info-circle", title: "Show output", color: "preview" }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "output", hidden: true, noInput: true },
            { key: "name", icon: "heading", label: "Name", placeholder: "Datasource name", readonly: false, required: true, help: "Alphanumeric with dash and underscore" },
            { key: "schema", icon: "database", label: "Schema", type: "select", readonly: false, required: true, parent: "schemas" , values: 'datasource/schema', valueKey: 'name', labelKey: 'name', hidden: true },
            { key: "cron", icon: "stopwatch", label: "Cron Schedule", help: "Minute Hour DayOfMonth Month DayOfWeek - For example : */5 * L * 1,3L", hidden: true, regex: { expression: "^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$", description: "Must be a valid cron schedule"} },
            { key: "form", icon: "play", label: "Form", placeholder: "Form name", readonly: false, required: true, hidden: true},
            { key: "status", label: "Status", noInput: true },
            { key: "state", label: "State", noInput: true },
            { key: "last_run", label: "Last Run", noInput: true },
            { key: "extra_vars", type: "editor", label: "Extra vars (YAML)", hidden: true, lang:"yaml", style:"width: 100%;height: 40vh;font-size:1rem", help: "Next to the extra vars, the datasource object itself will also be appended and the credentials that are defined in the form." }
        ]
    },    
    schedules:{
        type: "schedule",
        label: "Schedule",
        labelPlural: "Schedules",
        // reloadSeconds: 7,
        icon: "clock",
        actions: [
            { name: "edit", icon: "pencil", title: "Edit Schedule", color: "edit" },
            { name: "delete", icon: "trash", title: "Delete Schedule", color: "delete" },
            { name: "trigger", icon: "play", title: "Import Schedule", color: "refresh" },
            { name: "preview", icon: "info-circle", title: "Show output", color: "preview" }
        ],
        fields: [
            { key: "id", hidden: true, noInput: true },
            { key: "output", hidden: true, noInput: true },
            { key: "name", icon: "heading", label: "Name", placeholder: "Schedule name", readonly: false, required: true, help: "Alphanumeric with dash and underscore" },
            { key: "cron", icon: "stopwatch", label: "Cron Schedule", help: "Minute Hour DayOfMonth Month DayOfWeek - For example : */5 * L * 1,3L", hidden: true, required: true, regex: { expression: "^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$", description: "Must be a valid cron schedule"} },
            { key: "form", icon: "play", label: "Form", placeholder: "Form name", readonly: false, required: true, help: "The form that will run to import the data." , hidden: true},
            { key: "status", label: "Status", noInput: true },
            { key: "state", label: "State", noInput: true },
            { key: "last_run", label: "Last Run", type: "datetime", noInput: true },
            { key: "extra_vars", type: "editor", label: "Extra vars (YAML)", hidden: true, lang:"yaml", style:"width: 100%;height: 40vh;font-size:1rem", help: "No form to provide the extra vars, you must add them here." }
        ]
    },            
    knownhosts:{
        type: 'knownhosts',
        label: 'Known Host',
        removeDoubles: true, // remove double entries
        flat: true, // flat data structure,
        icon: 'fab,git',
        actions: [
            { name: 'preview', title: `Show Host Entry`, icon: 'info-circle', color: 'change' },
            { name: 'delete', title: `Delete Host Entry`, icon: 'trash', color: 'delete' }
        ],
        fields: [
            { key: 'id', label: 'Host Entry', filterable: true, hidden:true, noInput: true },
            { key: 'name', label: 'Host Entry', required: false, filterable: true, noInput: true },
            { key: 'host', label: 'Host', required: true, filterable: true, hidden:true }
        ]
    },
    credentials: {
        type: 'credential',
        label: 'Credential',
        icon: 'lock',
        actions: [
            { name: 'edit', title: `Edit Credential`, icon: 'pencil', color: 'edit' },
            { name: 'delete', title: `Delete Credential`, icon: 'trash', color: 'delete' },
            { name: 'change_password', title: `Change Password`, icon: 'lock', color: 'change' },
            { name: 'test', title: `Test Connection`, icon: 'plug', color: 'test', dependency: "is_database" }
        ],
        fields: [
            { key: 'id', label: 'ID', sortable: false, required: false, filterable: false, noInput: true, hidden: true, icon: 'key', noInput: true },
            { key: 'is_database', label: 'For Database', type: 'checkbox', hidden: true, placeholder: 'Enable database fields', required: false },
            { key: 'name', label: 'Name', sortable: true, required: true, filterable: true, icon: "lock", isKey: true },
            { key: 'user', label: 'User', sortable: true, required: false, filterable: true, icon: "user" },
            { key: 'password', label: 'Password', type: "password", sortable: false, required: true, filterable: false, icon: "lock", hidden: true },
            { key: 'host', label: 'Host', sortable: true, required: false, filterable: true, icon: "server" },
            { key: 'port', label: 'Port', type:"number", sortable: true, required: false, filterable: false, icon: "arrows-alt-v" },
            { key: 'description', label: 'Description', sortable: false, hidden: true, required: true, filterable: false, icon: "info-circle" },
            {
                key: 'db_type', label: 'Database Type', type: 'select',valueKey:"id", labelKey:"name" , sortable: false, hidden: true, required: true, parent:'databases',
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
            { key: 'db_name', label: 'Database', sortable: false, hidden: true, required: false, filterable: false, icon: "database", dependency: "is_database" }

        ]
    },
    ssh:{
        label: "SSH Key",
        type: "sshkey",
        icon: "key",
        fields: [
            { key: "art", label: "Private Key Art", type: "sshPrivateKeyArt", line: 0 },
            { key: "key", label: "Private Key", help:"Use to overwrite the current private key, know what your are doing!", type: "textarea",placeholder:"-----BEGIN RSA PRIVATE KEY-----", line: 1, required: true },
            { key: "publicKey", label: "Public Key", type: "sshPublicKey", line: 2 }
        ]
    },
    ldap: {
        type: "ldap",
        label: "Ldap",
        icon: "globe",
        actions: [
            { name: 'test', title: `Test Connection`, icon: 'plug', dependency: "enable" }
        ],    
        fields: [
            { key: "enable", label: "Enable Ldap", type: "checkbox", isAction: true },
            { key: "is_advanced", label: "Advanced", type: "checkbox", dependency: "enable", isAction: true },
            { key: "enable_tls", label: "Enable Tls", type: "checkbox", dependency: "enable", isAction: true },
            { key: "ignore_certs", label: "Ignore Certs", type: "checkbox", dependency: "enable_tls", isAction: true },        
            { key: "server", icon:"server", line: 0, label: "Server", required: true, dependency: "enable" },
            { key: "port", icon:"arrows-alt-v", type:"number", line: 0, label: "Port", required: true, dependency: "enable" },
            { key: "search_base", icon:"search", line: 1, label: "Search Base", required: true, dependency: "enable" },
            { key: "mail_attribute", icon:"envelope", line: 1, label: "Mail Attribute", required: true, dependency: "enable" },
            { key: "bind_user_dn", icon:"user", line: 2, label: "Bind User Dn", required: true, dependency: "enable" },
            { key: "bind_user_pw", icon:"lock", line: 2, label: "Bind User Password", type: "password", required: true, dependency: "enable" },
            { key: "username_attribute", icon:"image-portrait", line: 3, label: "Username Attribute", required: true, dependency: "enable" },
            { key: "groups_attribute", icon:"users", line: 3, label: "Groups Attribute", required: true, dependency: "is_advanced" },
            { key: "groups_search_base", icon:"users-viewfinder", line: 4, label: "Groups Search Base", required: false, dependency: "is_advanced" },
            { key: "group_class", icon:"users-rectangle", line: 4, label: "Group Class", required: false, dependency: "is_advanced" },
            { key: "group_member_attribute", icon:"users-line", line: 5, label: "Group Member Attribute", required: false, dependency: "is_advanced" },
            { key: "group_member_user_attribute", icon:"user-group", line: 5, label: "Group Member User Attribute", required: false, dependency: "is_advanced" },
            { key: "cert", icon:"certificate", type:"textarea", line: 6, label: "Certificate", required: true, dependency: "ignore_certs", negateDependency: true, placeholder:"-----BEGIN CERTIFICATE-----" },
            { key: "ca_bundle", icon:"certificate",type:"textarea", line: 6, label: "Ca Bundle", required: true, dependency: "ignore_certs", negateDependency: true, placeholder:"-----BEGIN CERTIFICATE-----" },
        ]
    },
    aap:{
        type: "awx",
        label: "Ansible Automation Platform",
        icon: "fac,ansible",
        actions: [
            { name: 'edit', title: `Edit Credential`, icon: 'pencil', color: 'edit' },
            { name: 'delete', title: `Delete Credential`, icon: 'trash', color: 'delete' },
            { name: 'change_password', title: `Change Password`, icon: 'lock', color: 'change' },
            { name: 'test', title: `Test Connection`, icon: 'plug', color: 'test' }
        ],
        fields: [
            { key: 'id', label: 'ID', sortable: false, required: false, filterable: false, noInput: true, hidden: true, icon: 'key', noInput: true },            
            { key: "use_credentials", label: "Use credentials", type: "checkbox", isAction: true, hidden: true, password_related: true },
            { key: "ignore_certs", label: "Ignore Certs", type: "checkbox", isAction: true, hidden: true },
            { key: "is_default", label: "Is Default", type: "checkbox", isAction: true },
            { key: "name", icon: "heading", line: 0, label: "Name", required: true },
            { key: "description", icon: "info-circle", line: 0, label: "Description", required: false },
            { key: "uri", icon: "globe", line: 0, label: "Uri", required: true },
            { key: "username", icon: "user", line: 2, label: "Username", required: true, dependency: "use_credentials", hidden: true },
            { key: "password", icon: "lock", line: 2, label: "Password", type: "password", required: true, dependency: "use_credentials", hidden: true },
            { key: "token", icon: "lock", line: 1, label: "Token", type: "password", required: true, dependency: "use_credentials", negateDependency: true, hidden: true },
            { key: "ca_bundle", icon: "certificate", type: "textarea", line: 6, label: "Ca Bundle", required: true, dependency: "ignore_certs", negateDependency: true, placeholder: "-----BEGIN CERTIFICATE-----", hidden: true },
        ],
    },
    mailSettings:{
        icon: "envelope",
        type: "settings",
        label: "Mail Settings",
        actions: [
            { name: "test", icon: "envelope", title: "Test Mail" }
        ],
        fields: [
            { key: "mail_secure", icon: "lock", label: "Use Tls", type: "checkbox", required: false, isAction: true },
            { key: "mail_server", icon: "server", line: 0, label: "Mail Server", required: true },
            { key: "mail_port", type:"number", icon: "arrows-alt-v", line: 0, label: "Mail Port", required: true },
            { key: "mail_username", icon: "user", line: 1, label: "Mail Username", required: false },
            { key: "mail_password", icon: "key", type: "password", line: 1, label: "Mail Password", required: false },
            { key: "mail_from", icon: "envelope", type: "email", line: 2, label: "Mail From", required: true },

        ]
    },
    backups: {
        icon: 'database',
        type: 'backup',
        label: 'Backup',
        labelPlural: 'Backups',
        idKey: 'folder',
        actions: [
            { name: 'preview', title: `Show Backup`, icon: 'info-circle', color: 'change' },
            { name: 'trigger', icon: 'undo', title: 'Restore', color: 'warning' },
            { name: 'delete', icon: 'trash', title: 'Delete', color: 'danger' }
        ],
        fields: [
            { key: 'folder', label: 'Folder', noInput: true },
            { key: 'date', label: 'Date', type: "datetime" , noInput: true },
            { key: 'description', label: 'Description', type: 'text' }
        ]
    },
}