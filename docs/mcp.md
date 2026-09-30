---
layout: default
title: MCP server
nav_order: 6
---

# MCP server
{: .no_toc }

Let an AI agent use your forms. AnsibleForms can serve a
[Model Context Protocol](https://modelcontextprotocol.io) server, so an MCP client - a chat
backend, an IDE assistant - can list the forms a user may use, work out their fields, launch
jobs and follow them.

1. TOC
{:toc}

## What it is, and what it is not

The MCP server is a technical interface to the same form flow the browser uses. It runs
**as the user whose token it receives**: the same form roles, the same job visibility, the
same checks on reserved extravars as a browser submission.

It adds no AI policy of its own. Whether an agent must ask for confirmation before a launch,
which forms it may use, or how many requests it may make is for the MCP client to decide.
The launch tool is marked as destructive, so a well-behaved client asks first, but nothing on
the server enforces that.

## Enabling it

Set [`ENABLE_MCP`](customization) to `1` and restart. The endpoint is

```
POST <your url>/api/v2/mcp
```

It speaks the Streamable HTTP transport, stateless, and answers in plain JSON. `GET` and
`DELETE` answer 405, because there are no sessions to stream or end.

## Authentication

Every request needs an AnsibleForms access token:

```
Authorization: Bearer <token>
```

Get one the usual way (`POST /api/v2/auth/login`, or the OIDC / Entra ID flows) and refresh
it with `POST /api/v2/token`. There is deliberately **no login tool**: a password passed as a
tool argument would end up in the language model's context and its chat history.

- **A chat backend** logs the user in itself, keeps the refresh token and passes the access
  token on every MCP call.
- **An IDE client** needs a token that lives long enough to configure once. A role with the
  `extendedTokenExpiration` option may log in with `?expiryDays=<n>` on the login url for a token valid that many days.

For example, with Claude Code:

```bash
claude mcp add --transport http ansibleforms https://af.example.com/api/v2/mcp \
  --header "Authorization: Bearer <token>"
```

## Tools

| Tool | What it does |
|---|---|
| `list_forms` | The forms the user may use: name, description, categories. |
| `get_form` | One form's full definition. Each field also carries `dynamic` (evaluated from an expression or query) and `dependsOn` (the fields it reads). |
| `resolve_field` | Evaluates the form for the values filled in so far. See below. |
| `launch_job` | Launches the form with the given values, exactly as a browser submission would. Returns the job id. |
| `relaunch_job` | Launches a job again with some fields changed. See below. |
| `get_job` | Status and output of a job (`tail` limits the output to the last lines). |

There is no tool to run an arbitrary expression, query, playbook or extravars. Expressions
and queries only ever run as the form defines them.

### Filling in a form

Call `resolve_field` with the form name and the values you have so far, then again after
every answer. It works through the fields in dependency order, the way a person fills in
the form, and reports per field:

- `status`: `resolved`, `waiting` (with `waitingFor`: the fields it still needs), `hidden`
  (its `dependencies` hide it) or `error` (evaluation failed; the field falls back to its
  default, as in the browser);
- `value`, `default` and, for choice fields, `options` (capped by `maxOptions`, default 200,
  with `optionCount` and `optionsTruncated`);
- `needsInput`: a required field without a value, or a choice field still on `__auto__`;
- `validationErrors`: the validation rules of the form the value breaks, as
  `[{type, description}]` with the message the browser shows - `required`, `regex`,
  `minValue`/`maxValue`, `minLength`/`maxLength`, `minSize`/`maxSize`, `sameAs`,
  `in`/`notIn`, `validIf`/`validIfNot`, `validYaml` (and `checkboxRequired`).

On top of that, `missing` lists the fields that need an answer, `invalid` the choices that
are not among the options and the fields that fail validation (collected in a top-level
`validationErrors` map), and `complete` says whether the form can be launched.
`launch_job` refuses a form that is not complete.

The rules are the browser's own: since 6.4 the browser, the MCP server and the launch
validation ([Launch validation](launch-validation)) run the same validation code. A
hidden field is not validated, and a dependency on `isValid` means what it means in the
browser: an empty optional field is valid, a hidden one is neither valid nor invalid.

Pass `field` to resolve only that field and what it depends on. For a list row or a wizard
step, pass `subform` (and optionally `parent`, the parent form's values).

Values are the raw values the browser holds: `true`/`false` for a checkbox, rows for a
list. A choice field takes the selected option record, a partial record (`{"name": "vol1"}`)
or its `valueColumn` value (`"vol1"`), or an array of those when it is `multiple`. Each is
replaced by the full option record before anything else is evaluated, so an expression or
query that reads another column (`$(cluster.management_ip)`) gets it. A computed field
ignores a value sent for it, unless it is `editable`.

### Approving the exact payload

When the form is complete, `resolve_field` also returns what `launch_job` will submit:

- `modeledExtravars`: the extravars after `model`, `valueColumn` and `output` are applied,
  with password fields masked;
- `credentials`: the AnsibleForms credentials the job will use (names, not secrets);
- `payloadHash`: a sha256 of the form name, the real extravars and the credentials;
- `formFingerprint`: a sha256 of the form definition it was resolved against.

Show `modeledExtravars` to the operator, and pass the `payloadHash` they approved to
`launch_job` as `expectedPayloadHash`. The launch resolves the form again and is refused
when the result differs, for example because a query now answers differently or the form
was edited. `ansibleforms_user`, `__jobid__` and `__verbose__` are added at launch and are
not part of the hash.

### Relaunching with changes

`relaunch_job` takes a job `id` and `values`: only the fields to change, as raw values. The
values the job was launched with are taken, `values` is laid over them, and the result is
resolved and validated exactly like `launch_job` - list rows included - and launched as a
new job by you (`ansibleforms_user` is you, not the original submitter). File uploads of
the original are reused. **Passwords are never stored**, so a form with a password field
anywhere - its subforms included - cannot be relaunched this way (`unsupported`, with the
`passwordFields`): its data lost the password.

Call it with `preview: true` first: it returns `modeledExtravars` (passwords masked),
`credentials` and a `payloadHash` without launching. Confirm them with the user, then call
it again with `expectedPayloadHash`. The same permissions as a relaunch in the browser
apply: the form must allow relaunch and your roles need the `allowJobRelaunch` option. A
job without stored form data (launched before relaunch existed), a form with a password
field and a wizard form cannot be relaunched this way.

The REST API does the same on `POST /api/v2/job/{id}/relaunch` with a body
`{ "values": { ... } }`; without a body it replays the job as it ran.

### Errors

A refused call is a tool error whose structured content carries a `code` and the details:

| Code | When |
|---|---|
| `form_incomplete` | `launch_job` or `relaunch_job` on a form that is not complete, with `missing`, `invalid`, `waiting`, `validationErrors` and `rowErrors` |
| `payload_mismatch` | the payload differs from `expectedPayloadHash`, with both hashes |
| `access_denied` | the user's roles do not grant the form or job, or verbose mode |
| `not_found` | no such form, subform or job |
| `unsupported` | a wizard form, a subform on its own, a file field, or `relaunch_job` on a form with a password field |
| `internal_error` | anything else |

## runLocal expressions

`runLocal` expressions, `local` / `credential` / `html` fields and `evalDefault` defaults are
evaluated on the server, in a separate V8 context: no `process`, `require`, network or
timers, no compiling strings into code, a 2 second time limit, and only the helper
functions the browser offers (`fnArray`, `fnGetNumberedName`, `fnToTable`, ...).

This guards against buggy or runaway expressions. It is not a sandbox for hostile code,
and it does not have to be: the code comes from the form definition, never from the MCP
caller, and every value a caller sends is substituted as a JavaScript literal.

An expression that uses a browser API (`window`, `document`, `fetch`) cannot run here and
comes back with `status: error`.

Server-side expressions (without `runLocal`) go through the same
[`EXPRESSION_SANITIZER`](customization) rules as they do for the browser.

## Limitations

- **Wizard forms** cannot be launched yet. Their steps can be resolved with `subform`.
- **File fields** cannot be filled in; a form whose file field has a value is refused.
- **List rows** (and a `yaml` field with a subform, which is one such row): every row you
  send (except one carrying the list's `deleteMarker`) is
  resolved through its subform with the form's values as `__parent__`, and validated -
  nested lists included, where `__parent__.__parent__` reaches the form. Send plain rows:
  the raw subform field values. Failing rows are listed per list field in `rowErrors`
  (`vms[1].disks[0].size (missing)` in the message). At most 500 rows per call, all levels
  together.
- An enum left on `__auto__` is never filled in with its first option: the caller chooses.
- Every MCP request is one entry in the audit log (action "MCP request"), the job itself is
  recorded under the user as for any other launch.
