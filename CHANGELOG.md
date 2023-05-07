# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ansibleguy76/ansibleforms/compare/4.0.9...HEAD

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

[2.1.6]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.5...2.1.6

[2.1.5]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.4...2.1.5
