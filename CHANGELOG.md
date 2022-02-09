# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.1...HEAD

[2.2.1]: https://github.com/ansibleguy76/ansibleforms/compare/2.2.0...2.2.1

[2.2.0]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.6...2.2.0

[2.1.6]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.5...2.1.6

[2.1.6]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.5...2.1.6

[2.1.5]: https://github.com/ansibleguy76/ansibleforms/compare/2.1.4...2.1.5
