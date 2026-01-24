---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Configuration (config.yaml)
description: | 
  AnsibleForms uses a config.yaml file for categories and roles configuration.<br>
  If none is provided, one will be generated with minimum configuration.<br><br>
  The config can also be imported into the database, eliminating the need for a config.yaml file.
# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: false

# Page navigation
page_nav:
    prev:
        content: Customization and Environment Variables
        url: '/customization'
    next:
        content: Forms Overview
        url: '/forms'
---

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign category_role_objects = formsyaml.help %}

# config.yaml

The config.yaml file contains the configuration for categories, roles, and constants used by AnsibleForms.

<a href="https://www.youtube.com/watch?v=lIhYZ9Et5Ic" class="btn btn--dark btn--rounded btn--w-icon">
  <span class="icon"><i class="fat fa-video"></i></span> <span class="ml-2">VIDEO : Create you first form</span>
</a>

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

**Note:** Only ONE repository should have "use for config" enabled. If multiple are enabled, a warning will be logged and the first one will be used.

<table class="table-responsive">
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
            <span id="formsyaml_{{ var.name }}" headinglevel="2" class="scrollspy fw-bold ">{{ var.name }}</span><br>
            <span class="has-text-primary">{{ var.type}}</span>
            {% if var.required==true %}<span class="has-text-danger"> / required</span>{% endif %}
            {% if var.unique==true %}<span v-if="f.unique" class="has-text-warning"> / unique</span>{% endif %}
            <br>
            {% if var.version %}<span v-if="f.version" class="is-italic has-text-success">added in version {{ var.version }}</span>{% endif %}
          </td>
          <td>
            <p>
              <strong>{{ var.short }}</strong><br>
              {% if var.docsObjectLink %}
              <a href="{{ var.docsObjectLink}}"><i class="fat fa-link"></i> 
              {% endif %}
              {% if var.allowed != nil %}
              <span class="has-text-primary">{{ var.allowed }}</span>
              {% endif %}
              {% if var.docsObjectLink %}
              </a>
              {% endif %}
            </p>
            <p markdown="1">
              {{ var.description }}
            </p>
            {% for c in var.changelog %}
            <div class="callout callout--info">
              {% if c.type == "added" %}
              <div class="tags has-addons mb-1">
                <span class="tag is-dark">Added</span><span class="tag is-success">{{ c.version }}</span>
              </div>
              {% endif %}
              <p markdown="1">
                {{ c.description }}
              </p>
            </div>
            {% endfor %}
            {% if var.examples %}
            <p class="fw-bold">
              Examples:
            </p>
            {% endif %}
            {% for e in var.examples %}
            <div>
              <p class="fw-bold mt-2">{{ forloop.index }}) {{ e.name }}</p>

<div markdown="1">
```yaml
{{ e.code }}
```
</div>

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
# {{ f.name }} Object

{{ f.description }}

<table class="table-responsive">
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
          <th id="{{ f.name }}_{{ group }}_group" colspan="2"  addclass="has-text-success"  class="fw-bold scrollspy is-success" headinglevel="2">
            {{ group }}
          </th>
        </tr>
        {% endif %}
        {% for var in group_properties %}
        <tr>
          <td>
            <span id="{{f.name}}_{{ var.name }}" headinglevel="3" class="scrollspy fw-bold">{{ var.name }}</span><br>
            <span class="has-text-primary">{{ var.type}}</span>
          
            {% if var.required==true %}<span class="has-text-danger"> / required</span>{% endif %}
            {% if var.unique==true %}<span v-if="f.unique" class="has-text-warning"> / unique</span>{% endif %}
            <br>
              
            {% if var.version %}<span v-if="f.version" class="is-italic has-text-success">added in version {{var.version}}</span>{% endif %}
          </td>
          <td>
            <p>
              <strong>{{var.short}}</strong><br>
              {% if var.docsObjectLink %}
              <a href="{{ var.docsObjectLink}}"><i class="fat fa-link"></i> 
              {% endif %}
              {% if var.allowed != nil %}
              <span class="has-text-primary">{{ var.allowed }}</span>
              {% endif %}
              {% if var.docsObjectLink %}
              </a>
              {% endif %}
            </p>
            <p markdown="1">
              {{ var.description }}
            </p>
            {% if var.choices.size > 0 %}
            <div class="">
              <span class="fw-bold">Choices:</span><br>
              <ul>
                {% for c in var.choices %}
                <li>
                  {% if c.name == var.default %}
                  <span title="{{ c.description }}" class="has-text-info">{{ c.name }} (default)</span>
                  {% else %}
                  <span title="{{ c.description }}">{{ c.name }}</span>
                  {% endif %}
                </li>
                {% endfor %}
              </ul>
            </div>
            {% elsif var.default != nil %}               
            <div>
              <span class="fw-bold">Default:</span><br>
              <span class="">{{ var.default }}</span>
            </div>   
            {% endif %}   
            {% if var.with_types!=nil %}
            <div>
              <span class="fw-bold has-text-danger">Only available with types:</span><br>
              <span class="">{{ var.with_types }}</span>
              <br><br>
            </div>
            {% endif %}                          
            {% for c in var.changelog %}
            <div class="callout callout--info">
              {% if c.type == "added" %}
              <div class="tags has-addons mb-1">
                <span class="tag is-dark">Added</span><span class="tag is-success">{{ c.version }}</span>
              </div>
              {% endif %}
              <p markdown="1">
                {{ c.description }}
              </p>
            </div>
            {% endfor %}
          </td>
        </tr>
{% endfor %}
{% endfor %}
{% if f.examples %}          
          <tr>
            <th id="{{ f.name }}_examples" colspan="2" addclass="has-text-success" class="fw-bold scrollspy is-dark" headinglevel="2">
              Examples
            </th>
          </tr>
          <tr>
            <td colspan="2">
              {% for e in f.examples %}
              <div>
                <p id="{{ f.name }}_examples_{{ forloop.index }}" class="scrollspy fw-bold" headinglevel="3"><span>{{ forloop.index }})</span> <span>{{ e.name }}</span></p>
<div markdown="1">
```yaml
{{ e.code }}
```
</div>
              </div>
              {% endfor %}            
            </td>
          </tr>      
{% endif %}
      </tbody>
</table>
{% endif %}
{% endfor %}