---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Customization
description: Use the environment variable to customize AnsibleForms ?

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
        content: Configuration
        url: '/configuration'
---

# Environment Variables

AnsibleForms is build with `Node.js` and when starting the application, you can pass variables to customize the application.  
These are called environment variables.  

<table class="table-responsive">
      <thead>
        <tr>
          <th>Variable</th>
          <th>Choices/Defaults</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
{% assign env = site.data.help[0].items %}
{% for var in env %}
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
          </td>
          <td>
               
          </td>
        </tr>
{% endfor %}
      </tbody>
</table>
