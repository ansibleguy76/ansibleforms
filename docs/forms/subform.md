---
layout: default
title: Subform
parent: Forms
nav_order: 4
---

# Subform
{: .no_toc }

A subform is a reusable form fragment. It is not shown in the tile view and cannot be submitted directly. Instead it is referenced by:

- A [`list`](/formfields/list.html) field — opens the subform as a drilldown editor for each row
- A [`yaml`](/formfields/yaml.html) field with the `subform` property — opens the subform as a drilldown editor for a single object

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form_object = formsyaml.help | where: "name", "Form" | first %}
{% assign type_prop = form_object.items | where: "name", "type" | first %}
{% assign subform_choice = type_prop.choices | where: "name", "subform" | first %}

{{ subform_choice.description | markdownify }}

{% if subform_choice.examples.size > 0 %}
{% for e in subform_choice.examples %}
**{{ e.name }}**
{% highlight yaml %}
{{ e.code }}
{% endhighlight %}
{% endfor %}
{% endif %}

## Properties

Subforms have **no type-specific properties**. They use only the [common form properties](common.html): `name`, `description`, `help`, `type`, and `fields`.

Execution properties (`playbook`, `template`, `roles`, `inventory`, etc.) are not applicable to subforms — a subform is never submitted directly.

