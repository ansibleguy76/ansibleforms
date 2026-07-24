---
layout: default
title: Config seed (config as code)
nav_order: 5
has_children: false
---

# Config seed (config as code)
{: .no_toc }

Declare your admin objects (AWX/AAP connections, credentials, oauth2 providers, repositories, ldap and settings) in a yaml file and let AnsibleForms apply it at startup. This closes the gap for teams that deploy AnsibleForms with GitOps tooling (ArgoCD, Flux, plain Helm) and want the whole instance defined in git, not clicked together in the UI.

---

## How it works

Set the environment variable `CONFIG_SEED_PATH` to the path of a seed file (in Kubernetes typically a mounted ConfigMap). At startup AnsibleForms reads the file and upserts every object it declares.

Objects that come from the seed are flagged **managed**:

* they are enforced on every startup, so the seed file is the source of truth for them
* the API (and therefore the UI) refuses to modify or delete them
* anything created by hand in the UI is never touched by the seed

Removing an object from the seed file only releases the managed flag, the record stays and becomes editable again. If you want removal to actually delete the record, set `prune: true` on that section.

The seed file itself contains **no secrets**. Secret values are written as `${SOME_ENV_VAR}` and resolved from the environment at apply time, so you can feed them from Kubernetes Secrets (for example via external-secrets and a vault). For credentials you can also use `vault_path` and skip storing the secret in AnsibleForms entirely.

A broken seed (invalid yaml, schema violation, a `${VAR}` that does not resolve) makes the server **refuse to start**. That is intentional: under a rolling update the previous pod keeps serving, so a typo can never take a running instance down, it only blocks the rollout of the bad configuration.

Note: the seed file is not related to `config.yaml`, which holds the forms configuration (categories, roles, constants).

## Sample seed file

```yaml
version: 1

awx:
  items:
    - name: tower
      uri: https://tower.example.com
      token: ${SEED_AWX_TOKEN}
      is_default: true

repositories:
  prune: true
  items:
    - name: forms
      uri: https://git.example.com/ansibleforms-forms.git
      branch: main
      user: git
      password: ${SEED_FORMS_REPO_TOKEN}
      use_for_forms: true
      use_for_config: true
      rebase_on_start: true
      cron: "*/30 * * * *"

credentials:
  items:
    - name: vcenter
      host: vcenter.example.com
      user: svc_forms
      password: ${SEED_VCENTER_PW}
      is_database: false
    - name: appdb
      host: db.example.com
      port: 3306
      db_type: mysql
      db_name: app
      vault_path: secret/app/db   # user/password come from HashiCorp Vault at runtime

oauth2:
  items:
    - name: EntraID
      provider: azuread
      client_id: ${SEED_AZURE_CLIENT_ID}
      client_secret: ${SEED_AZURE_CLIENT_SECRET}
      enable: true

ldap:
  server: ldap.example.com
  port: 389
  bind_user_dn: cn=bind,dc=example,dc=com
  bind_user_pw: ${SEED_LDAP_BIND_PW}
  search_base: dc=example,dc=com
  username_attribute: uid
  enable: true

settings:
  url: https://forms.example.com
  mail_server: smtp.example.com
  mail_port: 25
  mail_from: forms@example.com
```

## Sections

| Section | Type | Keyed by | Notes |
|---|---|---|---|
| `awx` | list | `name` | AWX/AAP/Ascender connections |
| `credentials` | list | `name` | supports `vault_path` |
| `oauth2` | list | `name` | oauth2/oidc providers |
| `repositories` | list | `name` | git repositories, same fields as the UI |
| `ldap` | object | single record | full ldap configuration |
| `settings` | object | single record | mail settings and url only, forms config and logo are untouched |

List sections accept `prune: true` to delete managed records that are no longer declared. The `ldap` and `settings` sections release their managed flag when removed from the file.

Users and groups are deliberately out of scope: identity is usually external (ldap or oauth2) and the initial admin user is already covered by `ADMIN_USERNAME`/`ADMIN_PASSWORD`.

## Kubernetes example

Mount the seed as a ConfigMap and feed the secrets from a Kubernetes Secret:

```yaml
env:
  - name: CONFIG_SEED_PATH
    value: /app/dist/persistent/seed.yaml
envFrom:
  - secretRef:
      name: ansibleforms-seed-secrets   # SEED_AWX_TOKEN, SEED_LDAP_BIND_PW, ...
volumeMounts:
  - name: seed
    mountPath: /app/dist/persistent/seed.yaml
    subPath: seed.yaml
volumes:
  - name: seed
    configMap:
      name: ansibleforms-seed
```

Rotating a secret means updating the Secret and restarting the pod (or redeploying), the seed re-applies on startup.
