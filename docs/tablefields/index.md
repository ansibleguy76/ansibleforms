---
layout: default
title: Tablefields
nav_order: 7
has_children: true
has_toc: false
---

# Tablefields
{: .no_toc }

Tablefields are field types used within table formfields. They define the columns and data entry controls for tabular data collection.

When you use a `table` formfield, each column is defined by a tablefield. Table fields are similar to regular formfields but with some restrictions since they operate within a row context.

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
      <td><strong><a href="{{ type.name }}/">{{ type.name }}</a></strong></td>
      <td>{{ type.description }}</td>
    </tr>
{%- endfor %}
  </tbody>
</table>
