---
layout: default
title: Launch validation
nav_order: 7
---

# Launch validation
{: .no_toc }

Check every launch of a form on the server - its validation rules, and the extravars the
job runs with - no matter who or what launches it: the browser, a script calling the REST
API, or an AI agent through the MCP server.

1. TOC
{:toc}

## Why it exists

A form's rules - `required`, `regex`, `minValue`, `sameAs`, ... - have always been checked
in the browser. The browser then sends two things to `POST /api/v2/job`:

- `rawFormData`: the field values as the user filled them in;
- `extravars`: what the playbook receives, built from those values in the browser.

The server used to trust both. Anyone with a valid token can call that endpoint directly
and send any extravars - with no regex, no required field and no list rule applied. For a
form that is only ever used in the browser that may be acceptable; for a form that is
launched by other systems over REST, it means the form's rules are not rules at all.

There is also no way for the server to tell "this came from the browser" apart from "this
is a script": both use the same endpoint, the same token and the same body, and a user can
change any request their own browser sends. The only place a check can be trusted is the
server. Launch validation is that check.

## The three ways in

| Launched by | Validated | Extravars the job runs with |
|---|---|---|
| **MCP server** (AI agent) | always, on the server | always built by the server |
| **Browser** or **REST API**, launch validation `off` | only in the browser | the ones the browser (or caller) sent |
| **Browser** or **REST API**, launch validation `log` | on the server, refusals only logged | the ones sent; differences logged |
| **Browser** or **REST API**, launch validation `enforce` | on the server, refused when invalid | **built by the server** |

The browser, the MCP server and the launch validation use one and the same code for the
rules (the shared form engine): the same rules, the same order, the same messages. What the
browser shows as an error, the server refuses with the same text.

## Switching it on

There are two settings. **The stricter of the two wins.**

### For the whole instance: `LAUNCH_VALIDATION`

The environment variable [`LAUNCH_VALIDATION`](customization) applies to every form:

- `off` (default) - no server-side check. An upgrade changes nothing.
- `log` - every launch is checked; what would be refused is written to the log as a
  warning, and the launch still runs as before.
- `enforce` - an invalid launch is refused, and a valid one runs the extravars the server
  builds.

It is applied without a restart.

### For one form: `launchValidation`

A form can set its own level:

```yaml
- name: Create VM
  type: ansible
  playbook: vm.yml
  launchValidation: enforce   # off | log | enforce
  fields:
    ...
```

This is the setting for an architect who knows a form will be launched over REST: that
form is enforced, the rest of the instance can stay on `off`. It can be set in the
designer, in the form settings.

**A form can be made stricter than the instance, never looser.** With `LAUNCH_VALIDATION`
on `enforce`, a form's `launchValidation: off` has no effect - an operator's decision
cannot be undone by a form.

Wizard forms cannot use it yet (see [Limitations](#limitations)): a wizard form with
`launchValidation` does not load, the form config reports the error.

## What `log` does

Every launch is checked, nothing changes for the user. The log gets a warning when:

- the launch **would be refused**, with the reason - field names and rule types only,
  never a value:

  ```
  Launch validation would refuse form 'Create VM' for alice (launch validation 'log') :
  failing rules : hostname (regex) ; failing rows : disks[1].size (maxValue)
  ```

- the extravars the client sent **differ** from the ones the server builds, with the
  top-level keys that differ:

  ```
  Launch of form 'Create VM' : the extravars differ from the ones the server builds for
  created_at, vm (launch validation 'log' ; 'enforce' would run the server's)
  ```

Use `log` first, on a real instance, for a while. It shows which forms would be refused and
which forms compute values differently on the server - before anyone is affected.

## What `enforce` does

### A launch that breaks the rules is refused

`POST /api/v2/job` answers `422` with the failing fields:

```json
{
  "error": "The form data is not valid",
  "details": {
    "missing": ["owner"],
    "invalid": ["hostname", "disks"],
    "waiting": [],
    "validationErrors": {
      "hostname": [{ "type": "regex", "description": "Must start with prod-" }]
    },
    "rowErrors": {
      "disks": [{ "index": 1, "invalid": ["size"],
                  "validationErrors": { "size": [{ "type": "maxValue", "description": "size must be at most 500" }] } }]
    }
  }
}
```

- `missing` - required fields without a value;
- `invalid` - fields that break a rule, choices that are not one of the options, and list
  fields with a failing row;
- `waiting` - fields that could not be evaluated (a field they need never got a value);
- `validationErrors` - per field, every failing rule with the message the browser shows;
- `rowErrors` - per list field, the failing rows (see [List rows](#list-rows-and-subforms));
- `uploads` - file fields whose upload could not be verified.

A launch that sends **no `rawFormData`** is refused too - the v1 API, or a REST call that
leaves it out - because its values cannot be checked. Leaving it out would otherwise be the
way around the check.

### A valid launch runs the server's extravars

The job does not run the extravars the client sent. The server builds them from the checked
values - with the same code the browser uses - and runs those. A caller that sends valid
`rawFormData` next to different `extravars` gets the extravars that match the values, not
the ones it sent.

Kept from the request: `__verbose__` (only for users allowed to use verbose mode). The
reserved keys (`__playbook__`, `__inventory__`, ...) come from the form, as always, and
`ansibleforms_user` is the launching user.

### What the user saw is not always what runs

Building the extravars means evaluating the form again: every expression and query runs
once more on the server, a moment after the browser ran it, as the launching user. A value
that depends on **when** or **where** it is evaluated can come out different - and then the
server's value runs:

| What | Why it can differ | How much |
|---|---|---|
| `fn.fnTime()`, a timestamp, a name built from the time | evaluated again, a few seconds later | only matters at a second or a date boundary. `fnTime` already runs on the server in the browser flow too, with the same timezone (the container's `TZ`) |
| a query, `fnRestAdvanced`, `fnSsh`, `fnDnsResolve`, a file read | the outside data changed in between | only when it changed |
| a `runLocal` expression using `new Date()`, `toLocaleString`, `Intl` | the browser uses the user's timezone and locale, the server its own | only such expressions |

The same goes for **validation**: a rule that reads such a field - `notIn` against a query's
result, `validIf` on a computed flag - is checked against the server's value. A form whose
extravars differ shows up in the `log` warnings above; check those before enforcing.

## List rows and subforms

A `list` field holds rows; each row is its subform, filled in through the row editor. A
`yaml` field with a `subform` is one such row. The server treats them like the browser's row
editor does: each row is resolved through its subform, with the form's values as
`__parent__`, its rules checked and its computed fields evaluated. Nested lists work the same
way - in a row's own list, `$(__parent__.__parent__.x)` reaches the form.

Which rows are checked:

- **a row the user added or edited** in the editor - it is resolved and validated;
- **a row nobody touched** - one the list's own default, expression or query produced, such
  as the existing entries of an ACL list - passes **exactly as it came**, as in the
  browser: not revalidated, nothing added. An existing entry that breaks a rule written
  later does not stop the launch.
- **a row marked deleted** (the list's `deleteMarker`) - kept as it is, not validated.

How the server tells them apart, without trusting the request: under launch validation, the
server runs the list's own source (its default, else its expression or query) again. A row
that did not go through the editor passes unchanged **only when it is one of the rows that
source produces**. Any other row - one a REST caller made up - is resolved and validated
like an edited row. So a plain row cannot slip past the checks, and the browser's untouched
rows still pass as they are.

The one case where a browser user notices this: the source's data changed between opening
the form and launching it (an entry was changed or removed meanwhile), **and** that row
breaks a rule of its subform. Then the row no longer counts as the source's, it is
validated, and the launch is refused naming the row - `acls[2].user_or_group (regex)`.

Failing rows are reported per list field in `rowErrors`, with the row's `index` (none for a
`yaml` field, which is one row); in the log as `disks[1].size (maxValue)`.

At most **500 rows** are resolved per launch, all nesting levels together: each row runs its
subform's expressions and queries. A launch with more is refused.

### Row markers

The markers a list sets on its rows - `insertMarker`, `updateMarker`, `deleteMarker` (new
rows get `__inserted__` when rows can be deleted or updated but no `insertMarker` is set) -
reach the playbook on every row that carries one. A removed row is sent with its delete
marker, so the playbook can remove it. Before 6.4.1 a list row only carried a marker when its
subform declared it as a (hidden) field.

## File uploads

The browser uploads a file first (`POST /api/v2/job/upload`) and sends the upload's
description with the launch (`files`). Under launch validation that description is checked:
the file must exist inside `UPLOAD_PATH`; its path and size are read from the disk, not from
the request. A file field only ever gets its value from such a verified upload - a path
written into `rawFormData` or `extravars` by the caller is dropped - so a required file
without a real upload is `missing`. The rules of a file field (`maxSize`, `regex` on the
file name) are checked against the real upload.

## Passwords

- A password may be stored in the database - the job's stored extravars hold it, so an
  approval can continue the job and a plain relaunch can replay it. It is used on the server
  only.
- **No API ever returns one.** A job read through the API (REST v1 and v2, the MCP server's
  `get_job`) masks every `password` field of its form at its model path - also inside list
  rows and yaml subforms - on top of [`MASK_EXTRAVARS_REGEX`](customization), which catches
  other secrets by key name.
- The raw form data of a job - sent back to the browser to prefill a relaunch - never holds
  a password, not even inside list rows or yaml subforms.

## Relaunching

| Relaunch | launch validation `off` / `log` | launch validation `enforce` |
|---|---|---|
| **as it ran** (the Relaunch button, `POST /api/v2/job/{id}/relaunch` without a body, `relaunch_job` without `values`) | a replay of the job's stored extravars, on the server - passwords included, as a relaunch always was | through the whole check above, from the job's stored field values |
| **with changes** (`POST /api/v2/job/{id}/relaunch` with `{ "values": { ... } }`, `relaunch_job` with `values`) | through the whole check above: the stored field values with `values` laid over them | same |

Whenever a relaunch goes through the check, the job is launched as a new job by the caller,
with the extravars the server builds. The stored field values never hold a password, so a
**password field the form shows** - at the top or in a list row - has lost its value, and
such a relaunch is refused (`unsupported`, with the `passwordFields`): launch the form
again and enter it. A password field the form's dependencies **hide** (for example through
a constant) is not needed and does not stand in the way. Under `enforce` that includes the
plain Relaunch button: a form that shows a password field cannot be replayed without its
password being entered again - which is the point of `enforce`.

Both need the form to allow relaunch (`allowRelaunch`) and the `allowJobRelaunch` role
option, and are only for **the job's owner**, an admin, or a user who sees every job
(`showAllJobLogs`). A job waiting for approval can be seen by its approvers, but not
relaunched by them.

## Rolling it out

1. Leave `LAUNCH_VALIDATION` on `off`; set `launchValidation: log` on the forms that are
   launched over REST - or `LAUNCH_VALIDATION=log` for the whole instance.
2. Run like that for a while and read the log: `would refuse` warnings are launches that
   break the rules; `extravars differ` warnings are forms that compute something differently
   on the server (a timestamp, outside data). Decide per form whether that matters.
3. Switch those forms to `launchValidation: enforce`. Callers that sent invalid values or
   made-up extravars now get a `422` with the reason.
4. When every form behaves, consider `LAUNCH_VALIDATION=enforce` for the whole instance.

## Limitations

- **Wizard forms** are not checked yet: a wizard sends its merged step output, not the raw
  field values, so the server has nothing to validate. Under `enforce` a wizard launch is
  refused; a wizard form cannot set `launchValidation`. The MCP server cannot launch wizard
  forms either.
- **Placeholder resolution** in the browser is still its own copy of the server's; in rare
  edge cases (`__undefined__`, quotes inside expressions) the two could resolve a placeholder
  differently. `log` shows such differences.
- **`runLocal`** expressions run in the browser's JavaScript there and in a server sandbox
  here; the same code gives the same result, except for what depends on the browser's
  timezone or locale.
