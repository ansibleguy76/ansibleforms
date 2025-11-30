# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [6.0.2] - 2025-11-30

### Added

-   MASK_EXTRAVARS_REGEX, to allow extravars masking
-   fnToTable local function, converts array to html table for html info field
-   GIT_CLONE_COMMAND and GIT_PULL_COMMAND env vars added
-   fnLs dir,{recursive,regex}
-   fnParseHtmlWithRegex url,regex,regexflags

### Fixed

-   Several tablefield issues
-   Datetime field didn't bubble changes
-   knownhosts errored on non existing file
-   Recursive checkdependencies
-   check schema for correct dependencies
-   dropdown/enum, working alignment
-   dropdown/enum, refresh and preview
-   readonly and disable props
-   tablefield readonlycolumns (issue 377)
-   on-event-actions fixed
-   fixed abondon jobs loop
-   fnSsh had a bug
-   schedules extravars

### Changed

-   Schema creation in 1 shot
-   lock api to v2
-   knownhosts api to v2

## [6.0.1] - 2025-10-28

### Fixed

-   not, notIn, validIf, validIfNot, all had bugs

### Changed

-   Docker image is moving to debian based.  It's bigger, but alpine was giving dns query issues.

### Added

-   playbooksSubfolder, a subfolder path to launch ansible-playbook from

## [6.0.0] - 2025-10-02

### Fixed

-   multi default in enum field broken
-   verbose was not working well
-   textarea field in table field
-   placeholder (issue 320)
-   scrollbar (issue 318)
-   EntraId groups (issue 316)
-   Add icon not allowed to radio
-   Fixed encryption key length check

## Added

-   updateMarker to table field
-   multi awx (314)
-   backup/restore api (/api/v2/database (get, post/backup, post/restore?folder=))
-   new role option allowDatabaseOps
-   oauth2 table replaces individual azuread, oidc tables
-   integrated backup

### Changed

-   Backend rewritten to ESM (export default / import) -> no more "require" and no more "babel" and no more compiled code
-   Parsing of forms rewritten with individual form validation, should be more stable and faster
-   Backend bumped to Node.js 20
-   Most packages are updated to latest versions
-   Frontend rewritten to work with Vite (still vue2 for now) -> no more "webpack"
-   New sass-dart and bumped bulma framework to 1.0.4
-   Password decryption had a bug in v6beta

### Breaking Changes

-   Since "require" can not be used anymore, the backend code is now ESM only.
    This means that you can not use "require" anymore, but you can use "import" and "export default".  Than means that custom functions must be rewritten to use the new ESM syntax. (/functions/custom.js is an example where this could break)
-   Maybe not breaking, but the old theme is broken for bulma v1, so it might look a bit different here and there. (but note that v6 will have bootstrap)
-   Since many packages are updated, I might have missed some breaking changes like OIDC, packages have been bumped and I don't have an OIDC to test against... any help is appreciated.

## [5.0.10] - 2025-06-05

### Added

-   LOG_TZ env var for timezone (both for logging and returning job logs)  Client convertion is disabled, so the client will always show the time in the timezone of the server.
-   Added new role option `enableLogin` to allow login for this role.  If not set, login is enabled.  Set to false on the public role to disable login overall, and set to true of the roles that should allow login.
-   fn.fnRestAdvanced allows 3 placeholderfunctions (base64, username and password)
-   fn.fnRestAdvanced allows a new "raw" parameter to return the data + the response_headers

### Fixed

-   Enum with multiple and objects were not always selecting correct defaults
-   5.0.9 had awx issues.

### Breaking Changes

-   Removed old deprecated type "query" (is enum now)

## [5.0.9] - 2025-06-04

### Fixed

-   Reduce formConfig by roles // <https://github.com/ansibleguy76/ansibleforms/issues/262>
-   User-based roles fix // <https://github.com/ansibleguy76/ansibleforms/issues/264>
-   Ldap DN with comma's, are now properly escaped // bump ldap-authentication - ldapjs => ldapts

### Added

-   Added 2 env vars VUE_APP_NAV_HOME_LABEL and VUE_APP_NAV_HOME_ICON and a forms nav link 
-   Datasources and schema see documentation for more info
-   Schedules, allow scheduled forms
-   hvac pip lib for hashi vault integration
-   awxApiPrefix, default to /api/v2, for future AAP changes (<https://github.com/ansibleguy76/ansibleforms/issues/279>)
-   Added 2 table field properties tableTitleAdd, tableTitleEdit (<https://github.com/ansibleguy76/ansibleforms/issues/277>)
-   Added option showAllJobLogs (<https://github.com/ansibleguy76/ansibleforms/issues/273>)
-   Added option to relaunch verbose (<https://github.com/ansibleguy76/ansibleforms/issues/280>)

## [5.0.8] - 2025-02-13

### Fixed

-   Regex in repo's
-   Jwt token issuer added (use env variable ACCESS_TOKEN_ISSUER) - credits to le-martre for the fix
-   maxBuffer causing abort by operator, adding PROCESS_MAX_BUFFER variable. // <https://github.com/ansibleguy76/ansibleforms/issues/247>

### Changed

-   The admin user can now be removed, and will be recreated automatically if needed at first start.
    use env variables ADMIN_USERNAME and ADMIN_PASSWORD.

### Added

-   YTT extra environment variable (see help)
-   Role options (showDesigner, showLogs, showSettings, ...) allowing for custom semi-admin or designer roles
-   Added branch to repos

## [5.0.7] - 2024-10-03

### Added

-   Added scm branch option to pass to awx

### Fixed

-   AzureAD with more than 100 groups was not working anymore since introduction of OIDC
-   Mysql check during init failed and skipped part of init
-   App now properly waits for mysql to be ready before starting
-   Vuelidate 2+ was not working properly for dependent required fields

## [5.0.6] - 2024-09-20

### Fixed

-   Removed ip lib parts CVE related
-   Updated to vuelidate 2+ (CVE related)

### Added

-   New dockerfile with debian

## [5.0.5] - 2024-09-18

### Fixed

-   Fixed regex for ssh key
-   New version highlight for CVE
-   Bumped several versions

## [5.0.4] - 2024-08-18

### Added

-   If forms.yaml is missing, it will be auto created. This is useful for new installations without docker-compose
-   Same for certificates

### Changed

-   Async await replacements for promises (readability)

### Fixed

-   Some credentials bugfixes

## [5.0.3] - 2024-06-21

### Added

-   Option to disable/enable schema creation (ALLOW_SCHEMA_CREATION)
-   Forms yaml can now be in the database (overriding the local file)
-   Database queries are by default no longer logged, use ENABLE_DB_QUERY_LOGGING to enable it again
-   Mongodb connection test

### Changed

-   Improved schema creation error messages and error handling
-   Schema patching is now done at application initialization
-   Rewrote database connections with await/async

### Fixed

-   Vault credentials, alpine requires decode -d instead --decode
-   Type on jobstatus notification template

## [5.0.2] - 2024-06-10

### Adding

-   Now allowing string (credential name) or array (of names) as dbConfig (dbtype is fetched from the database, with mysql fallback)
    When using array, the resultsets are merged.
-   Added ytt implementation to template yaml files (credits mdaugs)
-   Vault credentials, pass a vault password to ansible playbook.
-   OIDC authentication (credits mdaugs)
-   Ansibleforms will now wait for mysql to be ready before initializing

### Changed

-   job api return objects (extravars, notifications, credentials, ...) instead of json strings
-   awx job id is added to the database

### Fixed

-   radio button errors
-   some issue with the designer when a field without name was added
-   multistep was always successfull (tx to mdaugs)
-   using cookie session instead express session

## [5.0.1] - 2024-04-10

### Fixed

-   login expiryDays didn't work
-   fixed non-ascii codes in ldap
-   fixed approvals, broken since 4.0.19

### Added

-   add a form-reload route
-   added mail attribute ldap
-   improved error message on unevaluated fields
-   allow to model arrays like foo.bar[0].ping.pong[1]
-   allow placeholders in description fields of field validation

## [5.0.0] - 2024-01-25

### Added

-   in remote expression functions, we throw errors so they show up in the form.
-   added valueColumn "\*" and placeholderColumn "\*", to return all column, this also means that valueColumn "\*" results in the same as outputObject: true. 
-   jobid is passed now as extravar and passed to nextform, incase an action exists
-   you can now hide a text field
-   more advanced ldap properties for non active directory ldap servers
-   git repositories generic (for forms and playbook for example)
-   added expiryDays to login api, for longlived tokens (admin only)
-   added jwt tokenPrefix property on jwt functions
-   allow admin role fallback for local/admins group in case no forms are found
-   radio button values property can now have array of objects (label, value)
-   instanceGroups property on forms => choose awx instanceGroups
-   enable verbose checkbox for quick ansible verbose mode

### Removed

-   git repo type, you can no longer target git repo's from a form, this is breaking when you upgrade to 5.0.0 and use the formtype 'git'

### Fixed

-   awx workflow template failed with 404
-   ldap usernameattribute not used
-   fixed database query issue for postgres
-   use ldap-authentication main code (no npm)
-   try ldap group objectName first

## [4.0.19] - 2023-11-22

### Fixed

-   undefined error with json

### Added

-   Added AzureAD group filter to limit the number of groups

## [4.0.18] - 2023-11-10

### Fixed

-   javascript replace error with defaults
-   Newer Netapp collection 22.8.2

## [4.0.17] - 2023-11-07

### Fixed

-   AzureAD only returned first 100 groups.
-   Constants with arrays now work correctly
-   Little ldap test bug
-   model bug, bad merging and weird caching

### Added

-   Expression field can now have property `value` for manual data assignment
-   Added form property ansibleCredentials, allowing to pass ansible_user and ansible_password

## [4.0.16] - 2023-10-07

### Changed

-   Ansible has now default yaml stdout
-   fn.fnCredentials can have regex and a second ballback

### Added

-   New formfield type 'file' to upload files prior to job execution
-   New Database property in credentials, needed for postgres, and can be used for mysql and mssql
-   credentials property on forms => array of credentials to add
-   awxCredentials property on forms => array of awxCredentials to add
-   executionEnvironment property on forms => choose awx executionEnvironment

### Fixed

-   Int64 issues in rest results, new rest parameter 'hasBigInt'
-   Issue with null values in enum fields

## [4.0.15] - 2023-08-09

### Added

-   Installation video to documentation
-   add fnGetNumberedName as local function

### Fixed

-   Table expression issue fixed

## [4.0.14] - 2023-08-03

### Added

-   New documentation, the website ansibleforms is now generated on github pages using jekyll

### Changed

-   Removed environment variable from reference guide (find it in documentation now)

### Fixed

-   Scheme creation bug fixed
-   Typos in help
-   Vue2 bug number fields fall back to emptry string when empty.  fixed to set to undefined.

## [4.0.13] - 2023-07-24

### Added

-   New dependency mechanism isValid
    you can show/hide a field based if another field is valid or not

## [4.0.12] - 2023-07-15

### Changed

-   Modals are now 1024px

### Added

-   Allow enum array-of-objects values.
-   New alias local_out (=> hidden local expression)
-   New alias credential (=> hidden local expression with asCredential true)

## [4.0.11] - 2023-06-08

### Added

-   Allow users in roles

### Fixed

-   app crash on bad rest body
-   errors were not shown in output

## [4.0.10] - 2023-05-23

### Fixed

-   help added
-   fixed sql init
-   set a few columns to utf8mb4 for emoticon issues
-   add interval to cleanup 1 day old running jobs
-   better database check error handling, if the database is offline, no create schema button will be shown

### Added

-   Added alias type 'local' => expression, runLocal, hide, noOutput

## [4.0.9] - 2023-05-07

### Added

-   model can now be an array
-   html field

### Fixed

-   form could be executed while non-required fields were being evaluated

### Changed

-   expression field can have newlines, they will be removed.

## [4.0.8] - 2023-05-03

### Added

-   new function fn.fnCidr // core implementation of ip.subnet() <https://www.npmjs.com/package/ip>
-   new function fn.fnTime // core implementation of dayjs() <https://day.js.org>
-   background image on login screen (that you can overwrite)

## [4.0.7] - 2023-05-01

### Fixed

-   Default dependency bug
-   nested placeholder expressions
-   removed google font uri to local
-   awx retry jobs

### Added

-   Added clean up abandoned jobs at startup

## [4.0.5] - 2023-04-15

### Added

-   Allow awx connection with username and password
-   Added about me for
-   Added new env var with regex to filter job output

### Changed

-   Friendlier schema error messages

### Fixed

-   Non admin can see their own approve jobs
-   Wrong stdout with AWX sometimes

## [4.0.3] - 2023-03-06

### Fixed

-   Add select-all box with single column multiselect enum
-   Required not enforced on multiple enum
-   Log view since date-based logfiles
-   enum dropup correct calculation
-   issues with multistep and key
-   add user profile in steps

### Added

-   Add enum horizontal mode
-   Add azure ad oAuth2 login method
-   Add server fn.fnSsh function
-   Showing env.variables in the settings
-   Showing known_hosts and allow removal
-   Added limit property for ansible playbooks

### Changed

-   Moved form backups to subfolder (new ENV VAR)
-   Made backup age configurable (new ENV VAR)
-   New theme look
-   New settings menu
-   Improved joblog navigation, using url params

## [4.0.2] - 2023-02-10

### Added

-   Userobject is available in form with **user** => $(**user**)
-   New field type datetime (date and time picker)

### Changed

-   An object-expression is now possible => "{foo:'bar'}"
-   Bumped corejs and axios

### Fixed

-   Colons failed in password due to bad passport-http
-   Number field was exported as string

## [4.0.1] - 2023-01-27

### Fixed

-   Saving settings error
-   Table field issues

### Added

-   Ansible Galaxy collection community.general
-   TextArea field

### Changed

-   Designer readonly when locked

## [4.0.0] - 2022-12-31

### Fixed

-   Dependencies are now AND not OR
-   Using mysql2 lib to fix authentication issues
-   Fixed AWX Task issue when failed
-   Auto select current form in designer
-   Placeholder with dash bug
-   UTF8 character in extravars breaks local ansible execution

### Added

-   Added dynamic playbook and template name $(extravar)
-   Designer Locking (env var)
-   Pass external data to form
-   Reference Guide
-   Add verbose logging for ansible (verbose: true)
-   Add keepExtravars property to keep the tmp extravars json file

### Changed

-   Better error messages with remote expressions
-   Running extravars from tmp file (due to utf8 issues)
-   Rolling log file

### Deprecated

-   formfield type query is deprecated, use 'enum'

## [3.1.1] - 2022-11-10

### Fixed

-   Ldap certificate bug
-   Drop quotes on string placeholder
-   Expressions were forced to required field
-   Dropping mssql package to v8 hoping to fix hang up issue
-   Dependency bug fixed with multiple dependencies
-   Preview bug fixed when column was empty

### Added

-   Local selectAttr function
-   Local regexBy function
-   Add wildcard support on filterBy function
-   PostActionsEvents
    -   events: onSubmit, onSuccess, onFailure, onFinish
    -   actions with delay: load (a form), reload (same form), home, clear (reset form), hide/show (form)
-   ifExtraVar property on step for conditional step

## [3.1.0] - 2022-10-28

### Added

-   Search functionality forms
-   Full with html
-   Allow "notIn" and "in" validation in tablefields
-   Add nested categories

## [3.0.9] - 2022-10-21

### Fixed

-   Allow password type in tablefield
-   Fixed sql connection problems
-   Fixed filterColumns bug

### Added

-   Added fnArray runLocal functions (filterBy,distinctBy,sortBy)

## [3.0.7] - 2022-09-26

### Added

-   Allow secure connection for mysql

### Changed

-   Updated nodejs packages

## [3.0.6] - 2022-08-10

### Fixed

-   Fixed multiselect bug

## [3.0.5] - 2022-07-06

### Added

-   Add object-like default value for dropdowns
-   Add email notifications
-   Allow custom git user/email per repo

### Fixed

-   Allow selfsigned certificates in mailserver
-   Auto qdd repo hosts to known_hosts + add gui for manually

## [3.0.4] - 2022-06-09

### Fixed

-   Forgot fs-extra in package

### Added

-   Added 'ansibleforms_user' as object to extravars

## [3.0.3] - 2022-06-02

### Changed

-   Improved gui management (table format with paging and filtering)
-   Updated all packages and no-cache build

### Fixed

-   You cannot remove a group with users

## [3.0.2] - 2022-04-25

### Added

-   More form validations
-   Show expression and query form warnings
-   Allow for expression references to have full object placeholder .e.g. $(settings.servers[0].name)

### Changed

-   Rewrote all callbacks to promises
-   Query filter in dropdown

### Fixed

-   Remove query filter on values change
-   Reset query value when "no data"

## [3.0.1] - 2022-04-01

### Added

-   Syslog integration (use env variables to tune)
-   Relaunch and abort from joblog
-   Override repo clone command
-   Add log filtering and auto refresh
-   Approvals and rejections (using new approval property)

### Changed

-   Logger levels changed (error, warning, notice, info, debug) / debug is lowest (silly is deprecated)
-   Completely reworked job launch process (neater code and more reusable)
-   Swagger job launch is now at job level

### Fixed

-   Allow non rsa ssh key
-   Add job access to own jobs in joblog
-   Repo runs silent

### Removed

-   Ansible launch api (see job post now)
-   Awx launch api (see job post now)
-   Multistep launch api (see job post now)

## [3.0.0] - 2022-03-09

### Added

-   About + GPL License
-   Added new type : push to git
-   Added property `key` : allow extravars to be specific key
-   Added extravars to joblog
-   Added awx to joblog
-   Added new type : multistep
-   Added LogViewer
-   Added SSH key autogen + update
-   Added Git repo gui

### Fixed

-   Allow local expressions for query
-   Wrong timezone timestamp in joblog
-   Referencing (placeholder) multi select will now return array

### Removed

-   Awx and ansible get job api => is now native job api
-   Awx and ansible joboutput => is now native job output
-   Ansible and awx job aboort => is now native job abort

## [2.2.4] - 2022-02-15

### Added

-   Allow field named \_\_inventory\_\_ to have array to launch against multiple inventories (ansible only)
-   Add new validation `validIf` and `validIfNot`.  Use an expression field as validation.
-   Add new `refresh` property to manually or auto refresh expression/query fields.
-   Add table enhancements
    -   prepopulate with `query` and `expression`
    -   insertMarker and deleteMarker (to mark deleted or new records)
    -   allowDelete and allowInsert (to allow insert/delete)
    -   readonlyField
            With this table feature you can now load existing data and use table to modify it.  
            The allowInsert set to false will focus on modification only.  
            The deleteMarker set to value of choice, will allow you to use ansible `absent` for deleted records.  
            Read the wiki for more details.

### Fixed

-   Fixed a bug in notIn and in validation
-   Fixed (dependency + expression) bug
-   Fixed execute bug (read proper exit code)
-   Fixed Warning color to orange
-   Removed constants from new form in designer

### Changed

-   Upgrade from fontawesome 5 to 6
-   Label is no longer a required property

## [2.2.3] - 2022-02-11

### Added

-   function fnCredentials(name) to get credentials
-   function fnRestJwtSecure to pass a credential name, the password of the credentials is assumed the token
-   Add noLog property to field for expression and query fields, no expressions, queries and results will be logged.
-   Add new theme

### fixed

-   A clipping visualization improvement

## [2.2.2] - 2022-02-09

### Fixed

-   Dropdown box gets clipped at the bottom (was new bug since 2.2.1)
-   Dependencies either with valueColumn or dot-notation

## [2.2.1] - 2022-02-07

### Added

-   Toggle hidden fields for admins
-   Allow expression debug for admins

### Fixed

-   Ignore error if no forms subdir exists
-   Allow empty constants in designer (must be object bug)

## [2.2.0] - 2022-02-03

### Added

-   Keydown responsiveness on text fields (property `keydown`)
-   filtering to query fields (tune with `filterColumns` property)
-   view of objects and query results
-   queryfield-option in table field (`type: query` + `from`-property)
-   search-replace-box in editor (`ctrl-f` or `ctrl-h`)
-   Forms.yaml can be extended with more yaml files in `/forms` subdir.
-   auto backup on save (from editor)
-   restore backup (from editor)
-   Editor can now edit a single form
-   Added warnings in editor and form
-   Expression can be html (`isHtml` property)
-   Added constants section in forms.yaml (key-value pairs in yaml format)

### Fixed

-   Bad required validation when expression had default empty object or array
-   Interval kept running in the background

## [2.1.6] - 2022-01-25

### Added

-   Expressions can have defaults
-   Extra form checking and show warnings

### Changed

-   Secured JWT tokens even more

### Fixed

-   Fixed editable expression bug
-   Token issue

## [2.1.5] - 2022-01-20

### Added

-   Start with changelog
-   Start with version releases

## [2.1.4] - 2022-01-20

### Added

-   Start with changelog

### Changed

-   Hide AWX token
-   Add AWX ca-bundle for certificate verification
-   JWT tokens, allow multiple devices
-   Expression field can be `editable`

## [2.1.2] - 2022-01-17

### Added

-   Allow rest api search by name for credentials, users and groups

## [2.1.0] - 2022-01-16

### Added

-   Expression can now do a db query using `dbConfig` and `query`

### Changed

-   Fixed visualization bug

## [2.0.0] - 2022-01-13

### Added

-   Added sticky feature to Query field
-   Added pctColumns to Query field
-   Added now sorting description object on fnRestBasic
-   Added now sorting description object on fnReadJson
-   Added now sorting description object on fnReadYaml
-   Added fnRestJwt, rest with token
-   Added fnRestAdvanced, rest with custom headers
-   Added fnJq function, to do json queries
-   Added default definitions for jq (fnRound,fnRound0,fnRound1,fnRound2, fn2KB, fn2MB, fn2GB)
-   Added jq.custom.definitions to allow custom jq definitions
-   Added notIn and in validation

### Removed

-   Sort & Map on fnRestBasic is removed
-   Sort & Map on fnReadYaml is removed
-   Sort & Map on fnReadJson is removed

## [1.2.2] - 2022-01-12

### Added

-   Add custom.js to allow custom expression
-   Start keeping releases in docker-hub

## [1.2.1] - 2022-01-12

### Fixed

-   Ignore AWX certificate errors

## [1.1.9] - 2022-01-11

### Added

-   Allow check and diff in ansible and awx

## [1.1.8] - 2022-01-11

### Added

-   Allow change password for current local user
-   Start tracking versions

[Unreleased]: https://github.com/ansibleguy76/ansibleforms/compare/6.0.2...HEAD

[6.0.2]: https://github.com/ansibleguy76/ansibleforms/compare/6.0.1...6.0.2

[6.0.1]: https://github.com/ansibleguy76/ansibleforms/compare/6.0.0...6.0.1

[6.0.0]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.10...6.0.0

[5.0.10]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.9...5.0.10

[5.0.9]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.8...5.0.9

[5.0.8]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.7...5.0.8

[5.0.7]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.6...5.0.7

[5.0.6]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.5...5.0.6

[5.0.5]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.4...5.0.5

[5.0.4]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.3...5.0.4

[5.0.3]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.2...5.0.3

[5.0.2]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.1...5.0.2

[5.0.1]: https://github.com/ansibleguy76/ansibleforms/compare/5.0.0...5.0.1

[5.0.0]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.19...5.0.0

[4.0.19]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.18...4.0.19

[4.0.18]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.17...4.0.18

[4.0.17]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.16...4.0.17

[4.0.16]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.15...4.0.16

[4.0.15]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.14...4.0.15

[4.0.14]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.13...4.0.14

[4.0.13]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.12...4.0.13

[4.0.12]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.11...4.0.12

[4.0.11]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.10...4.0.11

[4.0.10]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.9...4.0.10

[4.0.9]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.8...4.0.9

[4.0.8]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.7...4.0.8

[4.0.7]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.5...4.0.7

[4.0.5]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.3...4.0.5

[4.0.3]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.2...4.0.3

[4.0.2]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.1...4.0.2

[4.0.1]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.0...4.0.1

[4.0.0]: https://github.com/ansibleguy76/ansibleforms/compare/3.1.1...4.0.0

[3.1.1]: https://github.com/ansibleguy76/ansibleforms/compare/3.1.0...3.1.1

[3.1.0]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.9...3.1.0

[3.0.9]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.7...3.0.9

[3.0.7]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.6...3.0.7

[3.0.6]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.5...3.0.6

[3.0.5]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.4...3.0.5

[3.0.4]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.3...3.0.4

[3.0.3]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.2...3.0.3

[3.0.2]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.1...3.0.2

[3.0.1]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.0...3.0.1

[3.0.0]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.4...3.0.0

[2.2.4]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.3...2.2.4

[2.2.3]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.2...2.2.3

[2.2.2]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.1...2.2.2

[2.2.1]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.0...2.2.1

[2.2.0]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.6...2.2.0

[2.1.6]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.5...2.1.6

[2.1.5]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.4...2.1.5
