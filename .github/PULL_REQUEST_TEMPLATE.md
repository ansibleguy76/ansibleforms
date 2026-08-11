<!--
Base branch should be `develop`, not `main`. See CONTRIBUTING.md.
Security problem? Do not open a PR or an issue - see SECURITY.md.
-->

## What this changes

<!-- One or two sentences. If it fixes an issue, "Fixes #123" here. -->

## Why

<!-- What breaks without it, or what it makes possible. -->

## How it was verified

<!--
What you actually ran, not what you assume. Reverting the fix and watching the test
fail is worth more than the test passing.
-->

- [ ] `cd client && npm run lint:check && npm run test && npm run build`
- [ ] `cd server && npm run lint:check && npm run test`

## Checklist

- [ ] Base branch is `develop`
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`, if a user or operator would notice
- [ ] UI strings added to **all six** locale files (`en`, `de`, `fr`, `it`, `es`, `nl`)
- [ ] New page has a router entry with a `beforeEnter` guard, and a matching sidebar `permission:`
- [ ] New database column is in **both** the schema patch and `create_schema_and_tables.sql`, plus `SCHEMA_MANIFEST`
- [ ] New environment variable has a `docs/_data/help.yaml` entry
