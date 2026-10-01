---
layout: default
title: Upgrading to 7
nav_order: 2.5
---

# Upgrading to 7
{: .no_toc }

AnsibleForms 7 removes everything that 6.x marked as deprecated. Most of it can be fixed
while you are still on 6.5, where the old and the new way both work. Do that first, then
upgrade.

1. TOC
{:toc}

## Before you upgrade (on 6.5)

### Forms live in their own files

7 reads forms only from the forms folder (`FORMS_FOLDER_PATH`) or a forms repository. The
base config (`config.yaml`, or the database) holds categories, roles and constants only.

- **A `forms.yaml` file:** rename it to `config.yaml`. On 6.5 the settings page has a
  **Convert forms.yaml to config.yaml** button for this.
- **Forms inside the base config** (a `forms:` section): move each one to a file of its own.
  In the 6.5 designer, drag the form to a file in the tree. 7 does not load a `forms:`
  section; it reports it as an error.
- **Environment variables:**

  | Removed | Use instead |
  |---|---|
  | `FORMS_PATH` | `CONFIG_PATH` and `FORMS_FOLDER_PATH` |
  | `ENABLE_FORMS_YAML_IN_DATABASE` | `ENABLE_CONFIG_IN_DATABASE` |

### The `table` field

A form with a `table` field fails validation in 7. Replace it with a `list` field and a
form of type `subform` - see
[How do I migrate from table to list](faq#how-do-i-migrate-from-table--tablefields-to-list--subform).
A column's `from` becomes an expression on `__parent__`.

### Renamed properties

| Removed | Use instead |
|---|---|
| `disableRelaunch: true` (form) | `allowRelaunch: false` |
| `noOutput: true` (field) | `output: false` |
| `enableLogin` (role option) | `allowLogin` |

### Datasources and data schemas

The datasource imports and their admin pages are gone, and so is the
`ansibleguy76.ansibleforms` collection, whose modules only fed them.

- Scheduled imports stop, and the upgrade drops the datasource definitions (the
  `datasource`, `datasource_schemas` and `staging` tables). Note down what you need first.
- The data schemas an import filled are databases of their own and stay. A form that
  queries them through a credential keeps working.
- To keep that data fresh, run the import as a playbook of your own, for example from a
  schedule.

### API v1

`/api/v1/*` is gone; use `/api/v2/*` (interactive docs at `/api/v2/docs`). For scripts the
usual calls are:

| v1 | v2 |
|---|---|
| `POST /api/v1/auth/login` | `POST /api/v2/auth/login` |
| `POST /api/v1/token` | `POST /api/v2/token` |
| `POST /api/v1/job` | `POST /api/v2/job` |

v2 answers with HTTP status codes (`400`, `403`, `404`, `422`) and a plain JSON body, not v1's
`{ status, message, data }` envelope.

## Image tags

| Tag | Points to |
|---|---|
| `latest` | the newest final release - stays on 6.5 until 7.0.0 is final |
| `6`, `6.5` | the newest 6.x / 6.5.x release |
| `next`, `7-beta` | the newest 7.0.0 beta |

Pin `6` to stay on 6.x patches; switch to `next` to try 7.

## Rolling back

Take a backup before you upgrade (**Settings → Backups**). 6.5 runs on a database upgraded
to 7, but the datasource definitions 7 dropped only come back from that backup.
