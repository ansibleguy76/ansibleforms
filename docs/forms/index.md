---
layout: default
title: Forms
nav_order: 5
has_children: true
has_toc: false
---

# Forms
{: .no_toc }


{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form_object = formsyaml.help | where: "name", "Form" | first %}

Forms are added as YAML files in the forms folder. Each YAML file can contain a single form or a list of forms. Subfolders are supported if you want to organize your forms.
Forms are the core of AnsibleForms. Each form represents a web interface that collects user input and executes an Ansible playbook or AWX/Tower template with that data.

**VIDEO**: [Create your first form](https://www.youtube.com/watch?v=lIhYZ9Et5Ic)

## Understanding Form Structure

Every form in AnsibleForms is a **[Form Object](#form-object-reference)**. This object contains all the configuration for a single form, including its name, type, roles, categories, and fields.

A basic form looks like this:

```yaml
forms:
  - name: Create VM
    type: ansible
    playbook: playbooks/create_vm.yml
    roles:
      - admin
    categories:
      - Provisioning
    fields:
      - name: vm_name
        type: text
        label: VM Name
```

See the **[Form Object Reference](#form-object-reference)** section below for all available attributes and configuration options.



## How forms are loading

AnsibleForms loads forms from the following locations:

1. **FROM REPOSITORIES** : All repositories with "use for forms" switch enabled (supports multiple repositories)
   - Forms are automatically merged from all enabled repositories
   - First checks for a `forms/` subfolder in each repository
   - Falls back to repository root if `forms/` subfolder doesn't exist
   
2. **FROM LOCAL FOLDER** : The local `forms/` folder (FORMS_FOLDER_PATH environment variable) if no repositories are configured

{: .warning }
> **Note:** You can enable "use for forms" on multiple repositories and all forms will be merged together. Make sure form names are unique across repositories to avoid conflicts.

## Form Object Reference

{{ form_object.description | markdownify }}

<table>
  <thead>
    <tr>
      <th>Attribute</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
    {% assign groups = form_object.items | map: "group" | uniq | sort_natural %}
    {% for group in groups %}
    {% assign group_properties = form_object.items  | where: "group",group %}
    {% if group %}
    <tr>
      <th id="{{ form_object.name }}_{{ group }}_group" colspan="2" class="af-group-header">
        {{ group }}
      </th>
    </tr>
    {% endif %}
    {% for var in group_properties %}
    <tr>
      <td>
        <span id="{{form_object.name}}_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
        <span class="af-type">{{ var.type}}</span>
        {% if var.required==true %}<span class="af-required"> / required</span>{% endif %}
        {% if var.unique==true %}<span class="af-unique"> / unique</span>{% endif %}
        <br>
        {% if var.version %}<span class="af-version">added in version {{var.version}}</span>{% endif %}
      </td>
      <td>
        <p>
          <strong>{{var.short}}</strong><br>
          {% if var.docsObjectLink %}
          <a href="{{ var.docsObjectLink | relative_url }}">🔗 
          {% endif %}
          {% if var.allowed != nil %}
          <span class="af-type">{{ var.allowed }}</span>
          {% endif %}
          {% if var.docsObjectLink %}
          </a>
          {% endif %}
        </p>
        <p>
          {{ var.description | markdownify }}
        </p>
        {% if var.choices.size > 0 %}
        <div>
          <strong>Choices:</strong><br>
          <ul class="af-choices-list">
            {% for c in var.choices %}
            <li>
              {% if c.name == var.default %}
              <span title="{{ c.description }}" class="af-default-choice">{{ c.name }} (default)</span>
              {% else %}
              <span title="{{ c.description }}">{{ c.name }}</span>
              {% endif %}
            </li>
            {% endfor %}
          </ul>
        </div>
        {% elsif var.default != nil %}               
        <div>
          <strong>Default:</strong><br>
          <span>{{ var.default }}</span>
        </div>   
        {% endif %}   
        {% if var.with_types!=nil %}
        <div>
          <strong class="af-with-types">Only available with types:</strong><br>
          <span>{{ var.with_types }}</span>
          <br><br>
        </div>
        {% endif %}                          
        {% for c in var.changelog %}
        <div class="af-changelog">
          {% if c.type == "added" %}
          <div class="af-changelog-header">
            <span class="af-badge af-badge-added">Added</span>
            <span class="af-badge af-badge-version">{{ c.version }}</span>
          </div>
          {% endif %}
          <p>
            {{ c.description | markdownify }}
          </p>
        </div>
        {% endfor %}
        {% if var.examples %}
        <p><strong>Examples:</strong></p>
        {% endif %}
        {% for e in var.examples %}
        <div>
          <p><strong>{{ forloop.index }}) {{ e.name }}</strong></p>
{% highlight yaml %}
{{ e.code }}
{% endhighlight %}
        </div>
        {% endfor %}
      </td>
    </tr>
    {% endfor %}
    {% endfor %}
    {% if form_object.examples %}          
    <tr>
      <th id="{{ form_object.name }}_examples" colspan="2">
        Examples
      </th>
    </tr>
    <tr>
      <td colspan="2">
        {% for e in form_object.examples %}
        <div>
          <p id="{{ form_object.name }}_examples_{{ forloop.index }}"><strong>{{ forloop.index }}) {{ e.name }}</strong></p>
{% highlight yaml %}
{{ e.code }}
{% endhighlight %}
        </div>
        {% endfor %}            
      </td>
    </tr>      
    {% endif %}
  </tbody>
</table>
