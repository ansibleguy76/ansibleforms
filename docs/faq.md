---
layout: default
title: FAQ
nav_order: 9
---

# Frequently Asked Questions

Common questions and answers about AnsibleForms features and usage.

## Getting Started

### Multi-Repository Form Management

Use multiple git repositories for forms.

AnsibleForms supports loading forms from multiple git repositories simultaneously. Forms from all repositories with the "Use for forms" switch enabled are automatically merged together.

**How it works:**
- Configure multiple repositories in Settings → Repositories
- Enable the "Use for forms" switch on each repository you want to load forms from
- Each repository can contain a `forms/` directory with form YAML files
- All forms from all repositories are merged together automatically
- Forms with duplicate names will trigger a warning (first one wins)

**Configuration File Discovery:**
- AnsibleForms will use the FIRST config.yaml (or config.yaml) found across all form repositories
- If multiple config files are found, a warning is logged
- You can have a single central config repository for shared categories/roles/constants
- Or use the local `persistent/config.yaml` file (checked if no repository config found)

**Best Practices:**
- Keep config.yaml in only ONE repository or use the local persistent/config.yaml
- Organize forms by team/project using separate repositories
- Use unique form names across all repositories to avoid conflicts
- Repository order matters: forms are loaded in database order

**Example Setup:**

```yaml
Repository 1 (Central Config):
  - config.yaml (categories, roles, constants)

Repository 2 (Network Team):
  - forms/
    - switch_config.yaml
    - router_setup.yaml

Repository 3 (Server Team):
  - forms/
    - server_deploy.yaml
    - backup_restore.yaml
```

All forms appear together in the UI, automatically merged!

### About Repositories

Sometimes you want collaboration and versioning and then git repositories are perfect.  
In version 5.0.0 you can now manage git repositories.  
Every repository is a subfolder of the repositories-path (`REPO_PATH` environment variable).  
Just go to settings / repositories and start managing repositories. You can either add ssh-based repositories (with public key/known hosts) or https based repositories, public or private with username/password/token.

**Since version 6.1.0**, you can add multiple repositories and use specific switches to control what they're used for:

#### Repository Switches (6.1.0+)

- **use for config** - Repository contains config.yaml (categories, roles, constants)
- **use for forms** - Repository contains forms (supports multiple repositories, forms are merged)
- **use for playbooks** - Repository contains Ansible playbooks and roles
- **use for vars files** - Repository contains vars files for forms

#### Repository Structure

Each repository can contain subfolders or files directly in the root:

- **config.yaml** - Placed in repository root (when using "use for config")
- **forms/** subfolder or root - Forms YAML files (when using "use for forms")
- **playbooks/** subfolder or root - Ansible playbooks (when using "use for playbooks")
- **vars/** subfolder or root - Vars files (when using "use for vars files")

If a subfolder doesn't exist, AnsibleForms will fall back to the repository root.

#### Single Repository vs Multiple Repositories

**Single repository approach** (all in one):
- Enable all switches on one repository
- Structure: `config.yaml` in root, `forms/`, `playbooks/`, and `vars/` subfolders

**Multiple repository approach** (separated):
- Use separate repositories for config, forms, playbooks, and vars files
- Each repository can have files directly in root (no subfolders needed)
- Forms can come from multiple repositories (will be merged)

**Important notes:**
- Only ONE repository should have "use for config" enabled (warning if multiple)
- Only ONE repository should have "use for playbooks" enabled (playbooks cannot be merged)
- Only ONE repository should have "use for vars files" enabled
- MULTIPLE repositories can have "use for forms" enabled (forms will be merged)

#### Configuration Priority

Config loading (first match wins):
1. Database (if imported)
2. Repository with "use for config" enabled
3. Repository with "use for forms" enabled (backwards compatibility)
4. Local CONFIG_PATH file
5. Legacy forms.yaml file

#### Additional Features

You can choose if the repository must be cloned when AnsibleForms starts, and you can add cron-schedule to schedule recurring pull-actions.  
Additionally, in the swagger interface, you will find a clone and pull rest api for webhooks.  
In case you want long-lived access tokens for the webhooks, with swagger you can pass an expiryDays parameter (for admin roles only) and create long-lived tokens.

## Job Management

### Job Relaunch with Pre-filled Data

Relaunch jobs with form data (v6.0.3).

AnsibleForms supports relaunching jobs with pre-filled form data. When you click the relaunch button in the jobs page, the form will open with all field values from the previous job submission.

**Security Features:**
- Password fields are automatically excluded from storage and retrieval for security
- Raw form data is stored separately from processed extravars (before model transformations)

**Permission Control:**

Forms can disable relaunch functionality using the `disableRelaunch` option:

```yaml
- name: Production Deployment
  disableRelaunch: true  # Prevents relaunching this form
```

Users must have the `allowJobRelaunch` role option enabled (admins have this by default):

```yaml
roles:
  - name: operators
    options:
      allowJobRelaunch: true  # Allow this role to relaunch jobs
```

**Most Restrictive Logic:** Relaunch is only available if BOTH conditions are met:
1. Form does NOT have `disableRelaunch: true`
2. User role has `allowJobRelaunch: true` (or user is admin)

**How it works:**
- Raw form data is saved to disk on job submission (excluding passwords)
- Clicking relaunch navigates to the form with `?prefillJobId=<id>` parameter
- Form loads with all previous values, respecting field dependencies and async queries
- Users can modify values before resubmitting

### Job Log File

Track progress via a job-specific log file (v6.1.2).

AnsibleForms can display a **job-specific log file** alongside the Ansible output, making it easy to track the progress of long-running custom modules that would otherwise produce no visible feedback during execution.

{: .note }
> This feature only works for direct Ansible jobs. AWX / Ansible Tower jobs are not supported.

**How it works:**
- During a job run, AnsibleForms watches for a log file at a well-known path inside the playbook folder
- When the job is retrieved (or polled), the contents of the log file are read and returned alongside the normal output
- The log file is displayed in a separate **Logfile** panel below the main Ansible output, with full ANSI colour support

**Log file path convention:**

```
<playbook_dir>/.joblogs/job_log_<jobid>.log
```

**AnsibleForms passes `__jobid__` automatically**, so you can assemble the path in your playbook without any extra configuration:

```yaml
job_log_path: "{{ vars['playbook_dir'] }}/.joblogs/job_log_{{ __jobid__ }}.log"
```

Pass this variable to any role or custom module that should write progress to the file.

**Responsibilities of the playbook / module developer:**
- **Create** the log file (and its `.joblogs/` directory) at the start of the operation
- **Write** meaningful progress messages as the operation proceeds
- **Delete** the file when it is no longer needed (e.g. at the start of a new run to avoid stale data)

**ANSI colour coding is supported.**  
You can use standard ANSI escape codes (e.g. `\033[92m` for green, `\033[91m` for red) in your log messages and they will be rendered as colours in the UI. This is ideal for distinguishing success, warning, and error states at a glance.

**Typical use case:**  
A custom Python Ansible module that performs a long sequence of API calls or data operations (e.g. a SnapMirror DR workflow) can append one line per step to the log file. The operator watching the job in AnsibleForms will see live progress in the Logfile panel as each polling cycle refreshes the output.

### Jobid

Pass the current jobid.

Ansible Forms automatically sends the current jobid in the extravars.  
You don't need to do anything.  
It is sent as `__jobid__`.

### Userinfo

Pass the current user.

Ansible Forms automatically sends the userinformation in the extravars.  
You don't need to do anything.  
It is sent as `ansibleforms_user`.

### Userinfo Form

Access current user info in the form (v4.0.2).

The field `__user__` is automatically added in the form.

```yaml
expression: $(__user__)
expression: "'$(__user__.username)'"
expression: $(__user__.groups)
expression: $(__user__.roles)
```

## Form Fields

### Cascaded Dropdowns

Make cascaded dropdowns.

`enum` fields (AKA dropdown boxes) can contain placeholders in their `query` or `expression` property in the format of `$(another_field)` or `$(another_field[0].name)`.  
The moment the referenced field changes, the referencing field gets re-evaluated, resulting in dynamic and cascading dropdown boxes.  
The power of this concept lies in the client web-application that is re-evaluating fields every 100ms.  With current processors and the chromium engine, this should be a very seamless experience.

{: .note }
> When you reference another enum field, you reference the selected values, NOT the full dropdown list. Use the `placeholderColumn`-property or a dot-notation like `$(city.name)`.  
> **New in v4.0.20**: setting placeholderColumn to "*" will output the entire record, instead of a single column.

```yaml
- type: enum
  dbConfig: 
    name: CONN1
    type: mysql
  query: select name from cmdb.city
  name: city_name
  label: Select a city
  default: Amsterdam
  required: true
  model: cmdb.city
  group: CMDB
- type: enum
  dbConfig: 
    name: CONN1
    type: mysql
  query: select datacenter.name from cmdb.datacenter,cmdb.city where datacenter.city_id=city.id
    and city.name='$(city_name)'
  name: datacenter_name
  label: Select a datacenter
  default: __auto__    # default can be "__auto__" (first item) or "__all__" (all items) or "__none__" (no default)
  multiple: true
  outputObject: true
  required: true
  model: cmdb.datacenter
  group: CMDB      

# or use the placeholderColumn property

- type: enum
  dbConfig: 
    name: CONN1
    type: mysql
  query: select id,name,description from cmdb.city
  name: city
  label: Select a city
  default: Amsterdam         # evaluated against valueColumn
  required: true
  model: cmdb.city
  group: CMDB
  valueColumn: name          # we choose the name column as value for placeholders
  placeholderColumn: id      # we can reference the id by using $(city)
  previewColumn: description # when you select a value, the dropdown will show description
  columns:                   # we hide id
  - name
  - description
- type: enum
  dbConfig: 
    name: CONN1
    type: mysql
  query: select name, capacity_pct from cmdb.datacenter where datacenter.city_id=$(city)
# this cascaded dropdown will react using "id" as placeholder
# or "query":"select name from cmdb.datacenter where datacenter.city_id=$(city.id)",  
# or reference the column in the placeholder                            
  name: datacenter_name
  label: Select a datacenter
  default: __auto__         # default can be "__auto__" (first item) or "__all__" (all items) or "__none__" (no default)
  multiple: true
  pctColumns
  - capacity_pct
  outputObject: true
  required: true
  model: cmdb.datacenter
  group: CMDB
```

### Field Placeholders

Reference another field's value.

Placeholders are references to other fields in the forms.  
A placeholder is always in the format `$(reference)`. Expressions or queries can contain placeholders.  
If the placeholder is pointing to a simple field (text, number, password), it will hold that field's value.  
If the placeholder is pointing to a object-based-enum field, then you must either use the `placeholderColumn`-property or a dot-notation like `$(city.name)`.  
If the placeholder is pointing to an expression field, then either the full object is returned or you can have an advanced placeholder reference like `$(myarray[0].name)` where you can create javascript-like references.

{: .important }
> Important to know is that the placeholder is replaced BEFORE the evaluation of the expression. If you expect the result to be a string, then you must wrap it with quotes!  
> **New in v4.0.20**: setting placeholderColumn to "*" will output the entire record, instead of a single column.

```yaml
- name: field1
  type: expression
  expression: "[{name: 'foo'},{name: 'bar'},{name: 'ansible'}]"
  runLocal: true
- name: field2
  type: expression
  expression: "'$(field1[0].name)'"  # result : 'foo' (note the wrapping quotes)
  runLocal: true
- name: field3
  type: expression
  expression: "$(field1)[0].name"  # result : {name: 'foo'}.name => 'foo'  
  runLocal: true    
- name: field4
  type: expression
  expression: "$(field1).slice(-1)[0].name"  # result : {name: 'ansible'}.name => 'ansible' 
  runLocal: true
- name: field5
  type: enum
  expression: $(field1).filter(x => x.name.includes('a'))   # result : [{name: 'bar'},{name: 'ansible'}]
  runLocal: true
  default: __auto__                                         # result: bar
- name: field6
  type: expression
  expression: "'$(field5)'"   # result : the selected item from field5 (default=bar)
  runLocal: true        
```

### Hide a Field

Hide a field.

You can hide a field using the field property `hide`.  
Or you can show/hide a field dynamically using the field properties `dependencies` and `dependencyFn`.

### Group Fields

Group fields together in a block.

Use the field property `group`. Fields with the same group name will be grouped in a block.

### Field Validation

Validate a field.

Have a look at the many validation field properties such as `regex`, `minValue`, `notIn`, ...

### Default Value on Enum

Enum default value.

There is obviously the field property `default` you can use to manipulate a default.  
And with `enum` fields, you can use `__auto__` for example to automatically select the first item.  

But sometimes you want to have a dynamic default, based on an expression.  
See the below example how we accomplish this.

```yaml
# using client javascript manipulation

- type: expression
  expression: "[{name:'bert'},{name:'ernie'},{name:'pino'}]"
  name: dropdownsource
  label: Dropdown source
  runLocal: true
- type: expression
  expression: "'pino'"
  name: dropdownsourceDefault
  label: Default source
  runLocal: true
- type: enum
  expression: "[...[{name:'$(dropdownsourceDefault)'}],...$(dropdownsource).filter(x => x.name!=='$(dropdownsourceDefault)')]"
  name: dropdownwithdefault
  label: Example with expression default by moving it to top
  runLocal: true
  default: __auto__     

# explained : 
# we take our default and merge it with the source where we filter out the default (to avoid doubles)    
# the default is thus shifted to the first element, which we can now select with the default `__auto__`
```

### Expression Default Value

Expression default value.

For text, number or date fields, you can use the `default` property to set a default value.  
But what if you want this to be dynamic? Like an expression?  

You can do this in 2 ways:  
* `editable`: use the editable property to make an expression-field editable
* `evalDefault`: use the evalDefault property to evaluate the default as an expression

```yaml
# using editable
- type: expression
  expression: "'$(some_other_field)'.toLowerCase()"
  name: field1
  runLocal: true
  editable: true # this will add an edit-button so you manually overwrite the expression value

# using evalDefault
- type: text
  name: field1
  default: "'$(some_other_field)'.toLowerCase()"
  evalDefault: true # it will treat the default as if it was an expression.
  # note : when `some_other_field` changes, the default will be re-evaluated
  # note2 : works for other fields too.

# more complex evalDefault example
- name: checkbox
  type: checkbox
- name: textfield1
  type: text
  line: line2
  default: ping
- name: textfield2
  type: text
  line: line2
  default: pong
- name: checkbox3
  type: checkbox
  line: line3
  label: This checkbox will default check if checkbox or textfield1==textfield2
  default: |
    (
      (c=false,t1="",t2="") => { return c || (t1==t2) }
    )( $(checkbox) , "$(textfield1)" , "$(textfield2)" )
    
  evalDefault: true
```

## Security & Credentials

### Credentials

Pass credentials.

Credentials can be add in several ways:
* using the field-property `asCredential`  
* using the `credentials` form-property (key-value pairs)
* using an extravar called `__credentials__`

```yaml
# assume you have 2 credentials created in Ansible Forms
# 1: vcenter
# 2: ad

# you want them exposed to the playbook as
# 1: vc_cred
# 2: ad_cred

# Method 1 : using asCredential field-property
fields:
- name: vc_cred
  type: expression
  runLocal: true
  expression: "'vcenter'"
- name: ad_cred
  type: expression
  runLocal: true
  expression: "'ad'"

# Method 2 : using credentials form-property   
name: myplaybook
type: ansible
credentials:
  vc_cred: vcenter
  ad_cred: ad
  veeam_cred : veeam_prod,veeam_dev # will first try veeam_prod, then as fallback veeam_dev

# Method 3 : using __credentials__ extravar
fields:
- name: __credentials__
  type: expression
  runLocal: true
  expression: "{vc_cred: 'vcenter',ad_cred: 'ad',veeam_cred:'$(veeam_server)'}"
  # note : in the expression you can use placeholders to make them dynamic
```

## Integration

### Query AWX/Tower/AAP

Query information from AWX or Ansible Automation Platform.

Sometimes you want to create dropdown boxes, with data from AWX or Tower.  
You can use `fn.fnRestBasic` or `fn.fnRestJwtSecure` to query to do this.

```yaml
name: Query awx
type: awx
awx: myAwxConfigName
template: my_template # will be overwritten by the field __template__
description: ""
awxCredentials:
  - vmware
executionEnvironment: my_execution_environment
roles:
  - public
categories: []
inventory: my_inventory # will be overwritten by the field __inventory__
tileClass: bg-info-subtle
icon: bullseye
fields:
  # make sure you add credentials called "awx_rest" where the password holds the token
  # if you like basic authentication, switch the expressions below to fn.fnRestBasic instead

  - name: organization
    label: Organization
    type: enum
    default: __auto__
    expression: "fn.fnRestJwtSecure('get','https://172.16.50.1/api/v2/organizations','','awx_rest','[.results[]]')"
    columns:
      - name
    valueColumn: id # => we want the organisation field to hold the id !!
  - name: __template__  # use this special name to override the template from the form
    label: Inventory
    type: enum
    default: __auto__
    expression: "fn.fnRestJwtSecure('get','https://172.16.50.1/api/v2/job_templates?organization=$(organization)','','awx_rest','[.results[]]')"
    columns:
      - name
    valueColumn: name
  - name: __inventory__  # use this special name to override the inventory from the form
    label: Inventory
    type: enum
    default: __auto__
    expression: "fn.fnRestJwtSecure('get','https://172.16.50.1/api/v2/inventories?organization=$(organization)','','awx_rest','[.results[]]')"
    columns:
      - name
    valueColumn: name    
  - name: __awxCredentials__  # use this special name to override the credentials from the form
    label: Inventory
    type: enum
    expression: "fn.fnRestJwtSecure('get','https://172.16.50.1/api/v2/credentials?organization=$(organization)','','awx_rest','[.results[]]')"
    multiple: true
    default: __auto__
    columns:
      - name
    valueColumn: name     
  - name: __executionEnvironment__  # use this special name to override the executionEnvironment from the form
    label: Inventory
    type: enum
    expression: "fn.fnRestJwtSecure('get','https://172.16.50.1/api/v2/execution_environments?organization=$(organization)','','awx_rest','[.results[]]')"
    default: __auto__
    columns:
      - name
    valueColumn: name           
```

## Customization

### Customization

Customize Ansible Forms.

Ansible Forms is a web-app. If you run it natively in nodejs, you could replace files or change them.  
But more recommended is to run it as a docker-image and add volume or file mappings. Our docker-compose projects already maps directories to make the database, playbooks, logs, certificates and ssh-keys persistent. Nothing is keeping you from adding more mappings to, for example, override the logo.  
There is also a `custom.js` file where you can add your own javascript functions to use in expressions. Just like you can address our functions with the prefix `fn.` (fn.fnRestBasic for example) you can access the custom functions with prefix `fnc.`.  
And you can add your own jq definitions as well in the same way with the `jq.custom.definitions.js`

```yaml
volumes:
  # Mount application folder to host folder (to maintain persistency)
  - ./data:/app/dist/persistent
  # Map custom functions for js expressions and jq
  - ./data/functions/custom.js:/app/dist/src/functions/custom.js
  - ./data/functions/jq.custom.definitions.js:/app/dist/src/functions/jq.custom.definitions.js
  # Map custom sshkey to local node .ssh location
  - ./data/ssh:$HOME_DIR/.ssh
  - ./data/git/.gitconfig:$HOME_DIR/.gitconfig    
  # Map custom logo
  - ./data/mylogo.svg:/app/dist/views/assets/img/logo_ansible_forms_full_white.svg
```

### Enable YTT

Enable ytt.

In the case you want to use ytt, it can be enabled by setting `USE_YTT=1`.  
Read more info about ytt (https://carvel.dev/ytt/).

{: .important }  
> This feature has not been heavily tested and was added as an enhancement with no feedback after it was added.  
> When using ytt, you must disable the designer, the designer will convert the yaml files to intermediate json and will drop the ytt syntax (which is yaml comments).

A `lib` directory needs to exist within the root directory and is automatically included for the ytt call.
Data can be provided globally by setting prefixed environment variables:  

```bash
YTT_VARS_PREFIX=YTT_VAR
YTT_VAR_INVENTORY_PATH=/tmp/inventory.yml
YTT_VAR_default_host=localhost
```  

Or by providing library data files:

```bash
YTT_LIB_DATA_DEMO=/tmp/demo_data.yml
```  

```yaml
# /tmp/demo_data.yml
message: 'hello demo'
```

**The library `demo` needs to exists in the ytt context (lib/_ytt_lib/demo/values.yml)**

```yaml
# lib/_ytt_lib/demo/values.yml
#@ data/values
---
demo: {}
```  

Then, the loaded data can be used:

```yaml
# config.yaml
#@ load("@ytt:data", "data")
#@ load("@ytt:library", "library")
#@ demo = library.get("demo")
---
categories:
  - name: Default
    icon: bars
roles:
  - name: admin
    groups:
      - local/admins
constants:
  data_values: #@ data.values
  demo: #@ demo.data_values()
```

## Access Control

### How do I restrict what users can do (role options)?

Control per-role UI permissions with role options.

Beyond restricting which forms a role can see, AnsibleForms has a set of **role options** that give finer control over what users of a role can do in the UI. Options are additive — admins always have full access.

See the full option reference in [config.yaml → Role options](config.html#role-options).

Common examples:

```yaml
roles:
  - name: operators
    options:
      showLogs: true          # can view job history and output
      allowJobRelaunch: true  # can relaunch previous jobs
      allowVerboseMode: true  # can enable verbose output on a run
  - name: designers
    options:
      showDesigner: true      # can open the YAML designer
      showSettings: false     # cannot access settings
  - name: schedulers
    options:
      allowJobScheduling: true  # can schedule forms
      allowJobStoring: true     # can save and load form data
```

{: .note }
> Most role options have a default (many default to `true`). Set an option explicitly only when you want to **override** the default — either to force-enable something that is off by default, or to force-disable something that is normally on. Admins always have full access regardless.

### How do I implement custom RBAC logic in my playbooks or forms?

User identity is available in both the frontend and backend at every execution.

At every form submission AnsibleForms automatically injects the current user's full identity into the extravars sent to Ansible:

```yaml
ansibleforms_user:
  username: jane.doe
  groups:
    - local/admins
    - ldap/network-team
  roles:
    - admin
    - operators
  options:
    showLogs: true
    allowJobRelaunch: true
    # ...all resolved role options
```

This means your playbook or any custom Ansible module can use `ansibleforms_user` directly to make fine-grained decisions — for example, only allowing certain groups to modify production inventory, or writing an audit trail with the submitter's username.

In the **frontend**, the same object is available via the special `__user__` field:

```yaml
fields:
  - name: is_admin
    type: expression
    runLocal: true
    hide: true
    expression: "$(__user__.roles).includes('admin')"

  - name: target_env
    type: enum
    values:
      - dev
      - staging
      - production
    # hide the production option for non-admins by cross-referencing __user__
    expression: |
      $(__user__.roles).includes('admin')
        ? ['dev','staging','production']
        : ['dev','staging']
    runLocal: true
    default: __auto__
```

**Typical patterns:**

- **Cross-reference an RBAC config file or database** — load a YAML/JSON file (via `fn.fnReadYamlFile` or an expression) that maps groups to allowed resources, then filter based on `$(__user__.groups)`
- **Audit trail** — pass `ansibleforms_user.username` as an extra variable to write who triggered the job
- **Dynamic field values** — show a different set of enum choices, pre-fill fields, or hide sections based on the user's groups or roles
- **Playbook-side authorization** — assert that `ansibleforms_user.groups` contains a required group before the playbook proceeds, as a defence-in-depth check independent of the form's `roles` list

## Job Scheduling

### How do I schedule a form to run automatically?

Run forms on a schedule or at a future time (v6.1.5).

AnsibleForms supports two scheduling modes via the job scheduling feature:

- **Cron schedule** — submit the form and it will run repeatedly on a cron expression (e.g. every night at 2 AM)
- **One-off / run later** — submit the form to run once at a specific future date and time

**Requirements:**
- The user's role must have `allowJobScheduling: true`
- The form must not have `disableRelaunch: true` (scheduling uses the same pre-fill mechanism)

**How it works:**
1. Open a form and fill in the values
2. Instead of clicking **Submit**, click **Schedule**
3. Choose a cron expression or a specific date/time
4. The job appears in the job list with a scheduled status and runs automatically at the configured time

Scheduled jobs can be viewed, edited, and cancelled from the job history page.

## Save & Load Form Data

### How do I save and reload form data without running a job?

Store form submissions for later use (v6.1.5).

The **Store** and **Load from store** actions let you save a snapshot of form field values to disk and reload them later — without triggering a job run. This is useful for saving complex configurations you want to reuse across multiple submissions.

**Requirements:**
- The user's role must have `allowJobStoring: true`

**How it works:**
1. Fill in the form
2. Click **Store** — the current field values are saved under a name you choose
3. Later, open the same form and click **Load from store** to restore the saved values
4. Review / adjust and submit as usual

{: .note }
> Password fields are never stored. Stored data is tied to the form name — loading from a different form will not work.

## Nested Forms & Structured Fields

### How do I collect structured or repeated data in a form?

Use `list` and `yaml` fields with subforms (6.2.0+).

For collecting complex structured data — like a list of servers, a set of network interfaces, or a single nested object — use the `list` or `yaml` field types together with a `subform`.

A **subform** is a reusable form fragment (defined with `type: subform`) that is never shown as a standalone tile. It exists solely to be referenced by fields in other forms. See the [Subform docs](forms/subform.html) for full reference.

**Collecting a list of structured rows — `list` field:**

```yaml
forms:
  - name: Server
    type: subform
    fields:
      - name: hostname
        type: text
        required: true
      - name: ip
        type: text
        regex: ^\d+\.\d+\.\d+\.\d+$

  - name: Deploy to servers
    type: ansible
    playbook: deploy.yml
    fields:
      - name: servers
        type: list
        subform: Server   # opens Server subform in a drilldown editor per row
```

The `servers` extravar sent to Ansible will be an array of objects: `[{hostname: "web1", ip: "10.0.0.1"}, ...]`

**Editing a single structured object — `yaml` field:**

The `yaml` field has three modes:

| Mode | How | Behaviour |
|---|---|---|
| **Editor** | default | Shows a full YAML syntax-highlighted editor the user can type in directly |
| **Readonly** | `readonly: true` | Renders the YAML value as formatted read-only text — no editing |
| **Subform** | `subform: MySubform` | Hides the raw editor; opens the subform as a drilldown editor on click |

```yaml
fields:
  # editor mode (default)
  - name: raw_config
    type: yaml

  # readonly mode
  - name: generated_config
    type: yaml
    readonly: true

  # subform mode
  - name: network_config
    type: yaml
    subform: NetworkConfig   # opens NetworkConfig subform as a drilldown editor
```

**Upload and download — `list` and `yaml` fields:**

Both field types support client-side file transfer via two optional properties:

```yaml
fields:
  - name: servers
    type: list
    subform: Server
    showLoadButton: true      # shows an Upload button — imports content from a local file
    showDownloadButton: true  # shows a Download button — exports current content to a file

  - name: config
    type: yaml
    showLoadButton: true
    showDownloadButton: true
```

{: .note }
> The `list` field replaces the deprecated `table` field. The `subform` form type replaces the deprecated `tableFields`.

### How do I migrate from `table` / `tableFields` to `list` / `subform`?

Migrate deprecated table fields (6.2.0+).

The old `table` field and `tableFields` property still work but show deprecation warnings. To migrate:

1. Extract the columns from `tableFields` into a new `type: subform` form with regular `formfields`
2. Replace the `table` field with a `list` field that references the subform via `subform: MySubformName`

**Before:**
```yaml
forms:
  - name: Manage users
    type: ansible
    playbook: users.yml
    tableFields:
      - name: username
        type: text
      - name: email
        type: text
    fields:
      - name: users
        type: table
```

**After:**
```yaml
forms:
  - name: User
    type: subform
    fields:
      - name: username
        type: text
      - name: email
        type: text

  - name: Manage users
    type: ansible
    playbook: users.yml
    fields:
      - name: users
        type: list
        subform: User
```

