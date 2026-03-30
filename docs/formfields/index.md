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

## Common Properties

All formfields share two fundamental properties:
- **name** (string, required): The unique identifier for the field
- **type** (string, required): The field type - determines which page below describes the available properties

Each field type has additional properties specific to its functionality. Click on a field type below to see its complete property reference.

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
      <td><strong><a href="/formfields/{{ type.name }}.html">{{ type.name }}</a></strong></td>
      <td>{{ type.description }}</td>
    </tr>
{% endfor %}
  </tbody>
</table>
