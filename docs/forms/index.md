---
layout: default
title: Forms
nav_order: 5
has_children: true
has_toc: false
---

# Forms
{: .no_toc }


Forms are added as YAML files in the forms folder. Each YAML file can contain a single form or a list of forms. Subfolders are supported if you want to organize your forms.
Forms are the core of AnsibleForms. Each form represents a web interface that collects user input and executes an Ansible playbook or AWX/Tower template with that data.

**VIDEO**: [Create your first form](https://www.youtube.com/watch?v=lIhYZ9Et5Ic)

## Understanding Form Structure

Every form in AnsibleForms is configured with a set of properties. See **[Common properties](common.html)** for the properties that apply to all form types, and the type-specific pages for additional properties.



## How forms are loading

AnsibleForms loads forms from the following locations:

1. **FROM REPOSITORIES** : All repositories with "use for forms" switch enabled (supports multiple repositories)
   - Forms are automatically merged from all enabled repositories
   - First checks for a `forms/` subfolder in each repository
   - Falls back to repository root if `forms/` subfolder doesn't exist
   
2. **FROM LOCAL FOLDER** : The local `forms/` folder (FORMS_FOLDER_PATH environment variable) if no repositories are configured

{: .warning }
> **Note:** You can enable "use for forms" on multiple repositories and all forms will be merged together. Make sure form names are unique across repositories to avoid conflicts.

## Form properties

Every form is configured via a set of properties. See the sub-pages for details:

- **[Common properties](common.html)** — apply to all form types (`name`, `description`, `help`, `type`, `fields`)
- **[Ansible forms](ansible.html)** — properties specific to `type: ansible`
- **[AWX forms](awx.html)** — properties specific to `type: awx`
- **[Multistep forms](multistep.html)** — properties specific to `type: multistep`
- **[Subform](subform.html)** — subforms only use the common properties
