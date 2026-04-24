---
layout: default
title: Job Status Actions
parent: Forms
nav_order: 7
---

# Job Status Actions
{: .no_toc }

Lifecycle hooks for form execution.

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form_object = formsyaml.help | where: "name", "Form" | first %}
{% assign jobstatus_object = form_object.help | where: "name", "Job Status Action" | first %}

{{ jobstatus_object.description | markdownify }}

You can use these hooks:
- `onSubmit` - Triggered when the form is submitted
- `onSuccess` - Triggered when the job completes successfully
- `onFailure` - Triggered when the job fails
- `onFinish` - Triggered when the job finishes (regardless of status)
- `onAbort` - Triggered when the job is aborted

## Attributes

<table>
  <thead>
    <tr>
      <th>Attribute</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
    {% for var in jobstatus_object.items %}
    <tr>
      <td>
        <span id="{{jobstatus_object.name}}_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
        <span class="af-type">{{ var.type}}</span>
        {% if var.required==true %}<span class="af-required"> / required</span>{% endif %}
        {% if var.unique==true %}<span class="af-unique"> / unique</span>{% endif %}
        <br>
        {% if var.version %}<span class="af-version">added in version {{var.version}}</span>{% endif %}
      </td>
      <td>
        <p>
          <strong>{{var.short}}</strong><br>
          {% if var.allowed != nil %}
          <span class="af-type">{{ var.allowed }}</span>
          {% endif %}
        </p>
        <p>
          {{ var.description | markdownify }}
        </p>
      </td>
    </tr>
    {% endfor %}
  </tbody>
</table>

## Examples

{% for example in jobstatus_object.examples %}
### {{ forloop.index }}) {{ example.name }}

```yaml
{{ example.code }}
```
{% endfor %}
