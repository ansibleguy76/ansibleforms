---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Categories
description: | 
  Configure AnsibleForms using 1 or more yaml files.  
  The master yaml file is <code>forms.yaml</code> and is the heart of your forms.

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
        content: Creating forms
        url: '/creatingforms'
---

{{ site.data.help[1].items[0].description }}

<table class="table-responsive">
      <thead>
        <tr>
          <th>Attribute</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
{% assign formsyaml = site.data.help[1].items %}
{% for var in formsyaml %}
        <tr>
          <td>
            <span class="fw-bold">{{ var.name }}</span><br>
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
            {% if var.example != nil %}
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
