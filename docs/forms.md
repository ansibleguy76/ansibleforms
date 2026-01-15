---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Forms Overview
description: | 
  Forms are added as YAML files in the forms folder.<br>
  Each YAML file can contain a single form or a list of forms.<br><br>
  Subfolders are supported if you want to organize your forms.
# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: false

# Page navigation
page_nav:
    prev:
        content: Configuration (config.yaml)
        url: '/config'
    next:
        content: Create forms
        url: '/form'
---

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}

# Forms

Forms are added as YAML files in the forms folder. Each YAML file can contain a single form or a list of forms. Subfolders are supported if you want to organize your forms.

<a href="https://www.youtube.com/watch?v=lIhYZ9Et5Ic" class="btn btn--dark btn--rounded btn--w-icon">
  <span class="icon"><i class="fat fa-video"></i></span> <span class="ml-2">VIDEO : Create you first form</span>
</a>

## Forms Loading

AnsibleForms loads forms from the following locations:

1. **FROM REPOSITORIES** : All repositories with "use for forms" switch enabled (supports multiple repositories)
   - Forms are automatically merged from all enabled repositories
   - First checks for a `forms/` subfolder in each repository
   - Falls back to repository root if `forms/` subfolder doesn't exist
   
2. **FROM LOCAL FOLDER** : The local `forms/` folder (FORMS_FOLDER_PATH environment variable) if no repositories are configured

**Note:** You can enable "use for forms" on multiple repositories and all forms will be merged together. Make sure form names are unique across repositories to avoid conflicts.

{% assign form_objects = formsyaml.help %}

{% for f in form_objects %}
{% if f.name == 'Form' %}
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
              {% if var.allowed != nil %}
              <span class="has-text-primary">{{ var.allowed }}</span>
              {% endif %}
            </p>
            <p>
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
              <p>
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
              <pre><code class="language-yaml">{{ e.code }}</code></pre>
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
                <pre><code class="language-yaml">{{ e.code }}</code></pre>
              </div>
              {% endfor %}            
            </td>
          </tr>      
          {% endif %}
      </tbody>
</table>
{% endif %}
{% endfor %}