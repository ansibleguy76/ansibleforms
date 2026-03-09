---
layout: default
title: config.yaml
nav_order: 4
has_children: false
---

# config.yaml
{: .no_toc }

AnsibleForms uses a config.yaml file for categories and roles configuration. If none is provided, one will be generated with minimum configuration. The config can also be imported into the database, eliminating the need for a config.yaml file.
{: .fs-6 .fw-300 }

---

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign category_role_objects = formsyaml.help %}

## Overview

The config.yaml file contains the configuration for categories, roles, and constants used by AnsibleForms.

**VIDEO**: [Create your first form](https://www.youtube.com/watch?v=lIhYZ9Et5Ic)

The file below is a minimal sample config.yaml file to start with.  
It has only the required `default` category and the required `admin` and `public` roles.

```yaml
categories: # a list of categories to group forms
  - name: Default
    icon: bars
roles: # a list of roles
  - name: admin
    groups:
      - local/admins
  - name: public
    groups: []
    options:
      allowJobRelaunch: true
constants: {} # free objects to re-use over all forms
```

## Configuration Loading Priority

AnsibleForms loads the config.yaml file in the following order (first match wins):

1. **FROM DATABASE** : If config is imported into the database, it will be used (highest priority)
2. **FROM REPOSITORY (use_for_config)** : Repository with "use for config" switch enabled (new in 6.1.0)
3. **FROM REPOSITORY (use_for_forms)** : Repository with "use for forms" switch enabled (backwards compatibility fallback)
4. **FROM LOCAL FILE** : The local `config.yaml` file (CONFIG_PATH environment variable)
5. **FROM LEGACY FILE** : The legacy `forms.yaml` file (FORMS_PATH environment variable)

{: .warning }
> **Note:** Only ONE repository should have "use for config" enabled. If multiple are enabled, a warning will be logged and the first one will be used.

## Main Attributes

<table>
  <thead>
    <tr>
      <th>Attribute</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
{% for var in formsyaml.items %}
{% if var.name == 'categories' or var.name == 'roles' or var.name == 'constants' %}
    <tr>
      <td>
        <span id="formsyaml_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
        <span class="af-type">{{ var.type}}</span>
        {% if var.required==true %}<span class="af-required"> / required</span>{% endif %}
        {% if var.unique==true %}<span class="af-unique"> / unique</span>{% endif %}
        <br>
        {% if var.version %}<span class="af-version">added in version {{ var.version }}</span>{% endif %}
      </td>
      <td>
        <p>
          <strong>{{ var.short }}</strong><br>
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
{% endif %}
{% endfor %}
  </tbody>
</table>

{% for f in category_role_objects %}
{% if f.name == 'Category' or f.name == 'Role' %}

## {{ f.name }} Object

{{ f.description | markdownify }}

<table>
  <thead>
    <tr>
      <th>Attribute</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
    {% assign groups = f.items | map: "group" | uniq | sort_natural %}
    {% for group in groups %}
    {% assign group_properties = f.items  | where: "group",group %}
    {% if group %}
    <tr>
      <th id="{{ f.name }}_{{ group }}_group" colspan="2" class="af-group-header">
        {{ group }}
      </th>
    </tr>
    {% endif %}
    {% for var in group_properties %}
    <tr>
      <td>
        <span id="{{f.name}}_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
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
      </td>
    </tr>
    {% endfor %}
    {% endfor %}
    {% if f.examples %}          
    <tr>
      <th id="{{ f.name }}_examples" colspan="2">
        Examples
      </th>
    </tr>
    <tr>
      <td colspan="2">
        {% for e in f.examples %}
        <div>
          <p id="{{ f.name }}_examples_{{ forloop.index }}"><strong>{{ forloop.index }}) {{ e.name }}</strong></p>
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
{% endif %}
{% endfor %}

AnsibleForms loads the config.yaml file in the following order (first match wins):

1. **FROM DATABASE** - If config is imported into the database (highest priority)
2. **FROM REPOSITORY (use_for_config)** - Repository with "use for config" switch enabled
3. **FROM REPOSITORY (use_for_forms)** - Repository with "use for forms" switch enabled (backwards compatibility)
4. **FROM LOCAL FILE** - The local `config.yaml` file (CONFIG_PATH environment variable)
5. **FROM LEGACY FILE** - The legacy `forms.yaml` file (FORMS_PATH environment variable)

{: .warning }
> Only ONE repository should have "use for config" enabled. If multiple are enabled, a warning will be logged and the first one will be used.

## Next Steps

- [Categories](config/categories) - Learn about organizing forms
- [Roles](config/roles) - Set up RBAC
- [Constants](config/constants) - Define global variables
