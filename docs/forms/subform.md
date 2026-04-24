---
layout: default
title: Subform
parent: Forms
nav_order: 5
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

Subforms support the same `fields` array as regular forms. The form-level properties below are the only ones applicable to subforms — execution properties (`playbook`, `template`, `roles`, etc.) are not used.

<table>
  <thead>
    <tr>
      <th>Attribute</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
    {% assign subform_props = form_object.items | where: "group", "basic" %}
    {% assign skipped = "roles,playbook,template,expression,steps,inventory,ansibleCredentials,vaultCredentials,awxCredentials,executionEnvironment,instanceGroups,scm_branch,tags,check,diff,verbose,limit,abortable,disableRelaunch,key" | split: "," %}
    {% for var in subform_props %}
    {% unless skipped contains var.name %}
    <tr>
      <td>
        <span id="subform_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
        <span class="af-type">{{ var.type }}</span>
        {% if var.required == true %}<span class="af-required"> / required</span>{% endif %}
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
        <p>{{ var.description | markdownify }}</p>
        {% if var.choices.size > 0 %}
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
          <strong>Default:</strong> {{ var.default }}
        </div>
        {% endif %}
        {% if var.examples %}
        <p><strong>Examples:</strong></p>
        {% for e in var.examples %}
        <div>
          <p><strong>{{ forloop.index }}) {{ e.name }}</strong></p>
{% highlight yaml %}
{{ e.code }}
{% endhighlight %}
        </div>
        {% endfor %}
        {% endif %}
      </td>
    </tr>
    {% endunless %}
    {% endfor %}
  </tbody>
</table>
