---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: First time use and Forms.yaml
description: | 
  Configuring AnsibleForms is done using 1 or more yaml files.<br>
  The master yaml file is <code>forms.yaml</code> and is the heart of your forms.<br><br>
  This file is so important, this is likely the most important part of this help documentation to get you started.  
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
        content: Create forms
        url: '/form'
---

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign formsyaml_items = forms_yaml.items %}
{% assign forms_objects = formsyaml.help %}

# Forms.yaml

{{ formsyaml.description }}

The file below is a minimal sample forms.yaml file to start with.  
If has only the required `default` category, the required `admin` and `public` roles and a very simple sample form with 1 text field.

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
constants: {} # free objects to re-use over all forms
forms: # a list of forms
  - name: Demo Form
    showHelp: true
    help: >
      This is a demo form
    roles:
      - public
    description: A simple form
    categories:
      - Demo
    icon: heart
    playbook: dummy.yaml
    type: ansible
    fields:
      - type: text
        name: username
        label: Username
```

To add more forms, you either extend the forms-list property in the forms.yaml file, or you make seperate yaml files under the forms folder.  Each file must contain [a single form item](#form-object).

<table class="table-responsive">
      <thead>
        <tr>
          <th>Attribute</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>

{% for var in formsyaml.items %}
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
{% endfor %}
      </tbody>
</table>

{% for f in forms_objects %}
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
                <p id="{{ f.name }}_examples_{{ forloop_index }}" class="scrollspy fw-bold" headinglevel="3"><span>{{ forloop.index }})</span> <span>{{ e.name }}</span></p>
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
{% endfor %}

{% assign form_list = formsyaml.help | where: "name", "Form" %}
{% assign form = form_list[0] %}
{% assign objects = form.help %}

{% for f in objects %}
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
                <p id="{{ f.name }}_examples_{{ forloop_index }}" class="scrollspy fw-bold" headinglevel="3"><span>{{ forloop.index }})</span> <span>{{ e.name }}</span></p>
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
{% endfor %}