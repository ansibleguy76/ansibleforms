---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Customization
description: Use the environment variables to customize AnsibleForms

# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: true

# Page navigation
page_nav:
    prev:
        content: Installation
        url: '/installation'
    next:
        content: Forms configuration
        url: '/forms'
---

# Environment Variables

{% assign help = site.data.help %}
{% assign env_vars_list = help | where: "name", "Environment Variables" %}
{% assign env_vars = env_vars_list[0] %}


{{ env_vars.description }}

<table class="table-responsive">
      <thead>
        <tr>
          <th>Variable</th>
          <th>Choices/Defaults</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
{% for var in env_vars.items %}
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
