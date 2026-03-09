---
layout: default
title: Formfields
nav_order: 6
has_children: true
has_toc: false
---

# Formfields
{: .no_toc }

Formfields define the input controls in your forms. Each field type has its own properties and behaviors for collecting different types of data.

AnsibleForms supports a wide variety of formfield types, from simple text inputs to complex tables and expressions. Choose the right field type based on the data you need to collect.

Browse the formfield types using the navigation sidebar, or refer to the table below:

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form_object = formsyaml.help | where: "name", "Form" | first %}
{% assign formfield = form_object.help | where: "name", "Formfield" | first %}
{% assign formfile = formfield.items | where: "name", "type" | first %}

<table>
  <thead>
    <tr>
      <th style="width: 25%;">Field Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
{% for type in formfile.choices %}
    <tr>
      <td><strong><a href="{{ type.name | relative_url }}">{{ type.name }}</a></strong></td>
      <td>{{ type.description }}</td>
    </tr>
{% endfor %}
  </tbody>
</table>
