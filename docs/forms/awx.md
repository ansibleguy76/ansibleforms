---
layout: default
title: AWX forms
parent: Forms
nav_order: 3
---

# AWX Forms
{: .no_toc }

AWX forms execute an AWX / Ansible Tower job template when submitted.

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form_object = formsyaml.help | where: "name", "Form" | first %}
{% assign type_prop = form_object.items | where: "name", "type" | first %}
{% assign awx_choice = type_prop.choices | where: "name", "awx" | first %}

{{ awx_choice.description | markdownify }}

{% if awx_choice.examples.size > 0 %}
{% for e in awx_choice.examples %}
**{{ e.name }}**
{% highlight yaml %}
{{ e.code }}
{% endhighlight %}
{% endfor %}
{% endif %}

## Properties

Properties specific to `type: awx`, in addition to the [common form properties](common.html).

{% assign awx_props = form_object.items | where_exp: "p", "p.with_types contains 'awx'" %}
{% assign awx_groups = awx_props | map: "group" | uniq | sort_natural %}
{% for group in awx_groups %}
{% assign group_props = awx_props | where: "group", group %}

## {{ group | capitalize }}

<table>
  <thead>
    <tr>
      <th>Attribute</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
    {% for var in group_props %}
    <tr>
      <td>
        <span id="awx_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
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
    {% endfor %}
  </tbody>
</table>
{% endfor %}
