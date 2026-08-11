# Contributing to AnsibleForms

Thanks for helping out. This is the short version of everything you need to know before
opening a pull request.

## Pull requests go to `develop`, not `main`

`main` is the released code. `develop` is where work lands, and releases are cut from it
by the **Create Release Branch** workflow. A PR opened against `main` will be asked to
retarget, so save yourself the round trip.

## Found a security problem?

**Do not open an issue.** See [SECURITY.md](SECURITY.md) — there is a private channel for
it, because this software holds Ansible credentials, database passwords and Vault tokens.

## Running it locally

```bash
npm run dev          # both halves: server on :3001, client on https://localhost:8443
```

The client uses a self-signed certificate, so the browser will warn on first visit. The
default login is `admin` / `AnsibleForms!123`.

You need a MySQL 8 (or MariaDB) instance and a `server/.env.development` telling the server
how to reach it — `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`. Against an empty database
the schema builds itself at startup.

## Before you push

CI runs exactly these, so running them first saves a round trip:

```bash
cd client && npm run lint:check && npm run test && npm run build
cd server && npm run lint:check && npm run test
```

Both sides are lint-clean and green, and the intent is to keep them that way. The server
suite needs no database — it runs against the stubs in `server/tests/__mocks__`.

## Things that are easy to get wrong

**Six locale files, always.** Every UI string goes through `t('key')`, and
`client/src/locales/` holds `en`, `de`, `fr`, `it`, `es` and `nl`. They are at exact
parity: same keys, same `{placeholder}` tokens. Adding a string to one and not the others
ships a missing translation. Server strings live in `server/src/locales/`, same six.

**Adding a page does not add a route.** `client/src/router/index.js` is hand-written, one
entry per page with its own `beforeEnter` guard. The guard has to match the permission the
page's API actually requires, and the sidebar entry in `AppSidebar.vue` needs the same
`permission:` value.

**Permission failures answer `403`, never `401`.** A global axios interceptor treats any
401 as a dead session and logs the user out, so a 401 for "you may not do this" throws the
user to the login page instead of showing an error. Add new permissions through the
`permissionGuard` helper in `server/src/lib/middleware.js`.

**A database column needs two edits.** `server/src/models/schema.model.js` (the patch, for
existing installs) *and* `server/src/db/create_schema_and_tables.sql` (for fresh ones), plus
an entry in `SCHEMA_MANIFEST` or the Status page will report a database as complete when it
is not. Note that SQL file **drops every table** — never run it against anything you care
about.

**Environment variables need a `docs/_data/help.yaml` entry.** That file is the single
source of truth for the label, the help text, the type and the allowed values. A variable
missing from it appears nowhere in the settings UI.

## Commit messages and changelog

Conventional-ish prefixes (`fix:`, `feat:`, `ci:`, `docs:`, `chore:`) are the norm. Add a
line to `CHANGELOG.md` under `## [Unreleased]` for anything a user or an operator would
notice — the release workflow turns that section into the release notes.

## Questions

Open a discussion or an issue. A draft PR with a question in it is also fine — it is
usually the fastest way to find out whether an approach fits.
