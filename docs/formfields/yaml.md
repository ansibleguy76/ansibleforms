---
layout: default
title: YAML
parent: Formfields
nav_order: 14
---

# YAML Formfield

A dedicated YAML editor field with syntax highlighting, validation, and file import/export capabilities for structured configuration data.

## Properties

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form_object = formsyaml.help | where: "name", "Form" | first %}
{% assign formfield_object = form_object.help | where: "name", "Formfield" | first %}

{%- if formfield_object and formfield_object.items %}

<table>
  <thead>
    <tr>
      <th>Attribute</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
    {% assign groups = formfield_object.items | map: "group" | compact | uniq | sort_natural %}
    {% for group in groups %}
    {% assign group_properties = formfield_object.items | where: "group", group %}
    <tr>
      <th id="formfield_{{ group }}_group" colspan="2" class="af-group-header">
        {{ group }}
      </th>
    </tr>
    {% for var in group_properties %}
      {%- assign item_types = var.with_types | split: ", " %}
      {%- assign type_match = false %}
      {%- if var.with_types %}
        {%- if item_types contains "yaml" %}
          {%- assign type_match = true %}
        {%- endif %}
      {%- else %}
        {%- assign type_match = true %}
      {%- endif %}
      {%- if type_match %}
    <tr>
      <td>
        <span id="formfield_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
        <span class="af-type">{{ var.type }}</span>
        {% if var.required==true %}<span class="af-required"> / required</span>{% endif %}
        {% if var.unique==true %}<span class="af-unique"> / unique</span>{% endif %}
        <br>
        {% if var.version %}<span class="af-version">added in version {{ var.version }}</span>{% endif %}
      </td>
      <td>
        <p>
          <strong>{{ var.short }}</strong><br>
          {% if var.allowed != nil %}
          <span class="af-type">{{ var.allowed }}</span>
          {% endif %}
        </p>
        <p>
          {{ var.description | markdownify }}
        </p>
        {% if var.name == "type" %}
        <div>
          <strong>Value:</strong><br>
          <span>{{ page.title | downcase }}</span>
        </div>
        {% elsif var.choices.size > 0 %}
        <div>
          <strong>Choices:</strong><br>
          <ul class="af-choices-list">
            {% for c in var.choices %}
            <li>
              {% if c.name == var.default %}
              <span title="{{ c.description }}" class="af-default-choice">{{ c.name }} (default)</span>
              {% else %}
              <span title="{{ c.description }}">{{ c.name }}</span>
              {% endif %}
            </li>
            {% endfor %}
          </ul>
        </div>
        {% elsif var.default != nil %}
        <div>
          <strong>Default:</strong><br>
          <span>{{ var.default }}</span>
        </div>
        {% endif %}
      </td>
    </tr>
      {%- endif %}
    {% endfor %}
    {% endfor %}
  </tbody>
</table>

## Examples

{%- assign type_choice = formfield_object.items | where: "name", "type" | first %}
{%- if type_choice.choices %}
  {%- assign yaml_type = type_choice.choices | where: "name", "yaml" | first %}
  {%- if yaml_type.examples %}
    {%- for example in yaml_type.examples %}

### {{ example.name }}

```yaml
{{ example.code }}
```
    {%- endfor %}
  {%- endif %}
{%- endif %}

{%- endif %}

## Accessing parent form data via `__parent__`

When a `yaml` field uses `subform` mode, AnsibleForms automatically injects a `__parent__` variable into the subform containing a snapshot of **all parent form field values** at the time the editor opens (including constants and vars).

Use it with the standard `$(...)` expression syntax in the subform's field definitions:

```yaml
forms:
  - name: NetworkConfig
    type: subform
    fields:
      - name: interface
        type: text
        label: Interface
        required: true

      - name: vlan
        type: enum
        label: VLAN
        # filter available VLANs based on the parent's selected region
        query: "select id,name from vlans where region='$(__parent__.region)'"
        dbConfig:
          name: MYDB
          type: mysql
        valueColumn: id
        placeholderColumn: name

      - name: mtu
        type: number
        label: MTU
        # default to 9000 in production, 1500 elsewhere
        expression: "$(__parent__.environment) === 'production' ? 9000 : 1500"
        runLocal: true

  - name: Configure server
    type: ansible
    playbook: configure.yml
    fields:
      - name: environment
        type: enum
        values: [dev, staging, production]

      - name: region
        type: enum
        values: [eu-west-1, us-east-1, ap-southeast-1]

      - name: nic
        type: yaml
        label: Network interface
        subform: NetworkConfig
```

{: .note }
> `__parent__` is stripped from Ansible extravars — it is a **frontend-only** helper. It is never sent to your playbook.
