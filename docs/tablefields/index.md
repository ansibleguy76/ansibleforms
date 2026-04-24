---
layout: default
title: Tablefields (deprecated)
nav_order: 7
has_children: true
has_toc: false
---

# Tablefields
{: .no_toc }

> **Deprecated.** Tablefields are used with the `table` formfield type, which is deprecated. Use the [`list`](/formfields/list.html) field type instead — it provides the same functionality with a drilldown subform UX and full output modelling support.
{: .warning }

Tablefields are field types used within table formfields. They define the columns and data entry controls for tabular data collection.

When you use a `table` formfield, each column is defined by a tablefield. Table fields are similar to regular formfields but with some restrictions since they operate within a row context.

## Common Properties

All tablefields share two fundamental properties:
- **name** (string, required): The unique identifier for the column
- **type** (string, required): The field type - determines which page below describes the available properties

Each tablefield type has additional properties specific to its functionality. Click on a tablefield type below to see its complete property reference.

Browse the tablefield types using the navigation sidebar, or refer to the table below:

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form_object = formsyaml.help | where: "name", "Form" | first %}
{% assign formfield = form_object.help | where: "name", "Formfield" | first %}
{% assign tablefield_obj = formfield.help | where: "name", "Tablefield" | first %}
{%- assign tablefile = tablefield_obj.items | where: "name", "type" | first -%}

<table>
  <thead>
    <tr>
      <th style="width: 25%;">Field Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
{%- for type in tablefile.choices %}
    <tr>
      <td><strong><a href="/tablefields/{{ type.name }}.html">{{ type.name }}</a></strong></td>
      <td>{{ type.description }}</td>
    </tr>
{%- endfor %}
  </tbody>
</table>
