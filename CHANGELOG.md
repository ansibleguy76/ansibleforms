# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

-   Syslog integration (use env variables to tune)
-   Relaunch and abort from joblog
-   Filter and auto refresh on joblog
-   Override repo clone command
-   Add log filtering and auto refresh
-   Approval and rejections (using new approval property)

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

[Unreleased]: https://github.com/ansibleguy76/ansibleforms/compare/3.0.0...HEAD

[3.0.0]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.4...3.0.0

[2.2.4]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.3...2.2.4

[2.2.3]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.2...2.2.3

[2.2.2]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.1...2.2.2

[2.2.1]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.0...2.2.1

[2.2.0]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.6...2.2.0

[2.1.6]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.5...2.1.6

[2.1.6]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.5...2.1.6

[2.1.5]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.4...2.1.5
