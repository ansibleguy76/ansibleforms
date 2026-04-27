---
layout: default
title: List
parent: Formfields
nav_order: 13
---

# List Formfield

A list field displays a table of rows where each row is created and edited through a dedicated **subform** pane (drilldown pattern). It supersedes the deprecated `table` field.

## Key features

- Each row is edited in a full-screen subform, giving access to every field type including nested lists.
- The subform is declared as a separate top-level form of type `subform` and can be **reused across multiple list fields** in different forms (e.g. a single `Address` subform shared by customers, suppliers, orders…).
- Supports the same marker properties as the `table` field (`insertMarker`, `updateMarker`, `deleteMarker`) so playbook idempotency patterns still work.
- When `allowDelete: false`, pre-existing rows are protected; only rows added in the current session (carrying the `insertMarker`) can be deleted.
- The `columns` property controls which subform fields appear as columns in the summary table.
- The output is always an array of objects. `model`, `noOutput`, `outputObject` and `valueColumn` declared on subform fields are honoured when generating extravars.

## Subform declaration

A subform is a top-level form entry with `type: subform`. It accepts the same `fields` array as any other form but is never shown in the form tile list and is never submitted directly.

```yaml
forms:
  - name: Address
    type: subform
    fields:
      - name: street
        type: text
        label: Street
        required: true
      - name: city
        type: text
        label: City
        required: true
      - name: country
        type: text
        label: Country
```

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
    {% assign has_list_props = false %}
    {% for var in group_properties %}
      {%- assign item_types = var.with_types | split: ", " %}
      {%- if var.with_types == nil or item_types contains "list" %}
        {%- assign has_list_props = true %}
      {%- endif %}
    {% endfor %}
    {% if has_list_props %}
    <tr>
      <th id="formfield_{{ group }}_group" colspan="2" class="af-group-header">
        {{ group }}
      </th>
    </tr>
    {% for var in group_properties %}
      {%- assign item_types = var.with_types | split: ", " %}
      {%- assign type_match = false %}
      {%- if var.with_types %}
        {%- if item_types contains "list" %}
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
          <span>list</span>
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
        {% if var.examples.size > 0 %}
        <details>
          <summary>Examples</summary>
          {% for ex in var.examples %}
          <p><strong>{{ ex.name }}</strong></p>
          <pre><code class="language-yaml">{{ ex.code }}</code></pre>
          {% endfor %}
        </details>
        {% endif %}
      </td>
    </tr>
      {%- endif %}
    {% endfor %}
    {% endif %}
    {% endfor %}
  </tbody>
</table>

{%- endif %}

## Examples

### Shared address subform

```yaml
forms:
  - name: Address
    type: subform
    fields:
      - name: street
        type: text
        label: Street
        required: true
      - name: city
        type: text
        label: City
        required: true
      - name: country
        type: text
        label: Country

  - name: Create customer
    type: ansible
    playbook: customer.yaml
    fields:
      - name: name
        type: text
        label: Customer name
        required: true
      - name: addresses
        type: list
        label: Addresses
        subform: Address
        columns:
          - city
          - country
        titleAdd: Add address
        titleEdit: Edit address
        allowInsert: true
        allowDelete: true
```

### Marker tracking (idempotency-aware)

```yaml
- name: people
  type: list
  label: People
  subform: Person
  allowDelete: false       # preloaded rows are protected
  insertMarker: added      # session-added rows remain removable
  updateMarker: updated
  deleteMarker: removed
  columns:
    - name
    - email
```

### Nested lists

```yaml
forms:
  - name: Address
    type: subform
    fields:
      - name: street
        type: text
        label: Street
      - name: city
        type: text
        label: City

  - name: Person
    type: subform
    fields:
      - name: name
        type: text
        label: Name
        required: true
      - name: addresses
        type: list
        label: Addresses
        subform: Address
        columns:
          - street
          - city

  - name: My Form
    type: ansible
    playbook: people.yaml
    fields:
      - name: people
        type: list
        label: People
        subform: Person
        columns:
          - name
          - addresses
```

### Accessing parent form data via `__parent__`

When a subform row editor opens, AnsibleForms automatically injects a `__parent__` variable into the subform containing a snapshot of **all parent form field values** (including constants and vars).

Use it with the standard `$(...)` expression syntax in the subform's field definitions:

```yaml
forms:
  - name: NodeConfig
    type: subform
    fields:
      - name: node_name
        type: text
        label: Node name
        required: true

      - name: node_type
        type: enum
        values:
          - standard
          - high-memory
          - gpu
        # only offer gpu in production environments (parent field)
        expression: |
          $(__parent__.environment) === 'production'
            ? ['standard', 'high-memory', 'gpu']
            : ['standard', 'high-memory']
        runLocal: true
        default: __auto__

  - name: Deploy cluster
    type: ansible
    playbook: deploy.yml
    fields:
      - name: environment
        type: enum
        values: [dev, staging, production]
        required: true

      - name: nodes
        type: list
        subform: NodeConfig
        columns: [node_name, node_type]
```

{: .note }
> `__parent__` is stripped from Ansible extravars — it is a **frontend-only** helper. It is never sent to your playbook.

