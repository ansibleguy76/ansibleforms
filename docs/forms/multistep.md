---
layout: default
title: Multistep forms
parent: Forms
nav_order: 5
---

# Multistep forms
{: .no_toc }

Create sequential workflows with multistep forms.

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form_object = formsyaml.help | where: "name", "Form" | first %}
{% assign type_prop = form_object.items | where: "name", "type" | first %}
{% assign multistep_choice = type_prop.choices | where: "name", "multistep" | first %}
{% assign step_object = form_object.help | where: "name", "Step" | first %}
{% assign steps_prop = form_object.items | where: "name", "steps" | first %}

{{ multistep_choice.description | markdownify }}

{% if multistep_choice.examples.size > 0 %}
{% for e in multistep_choice.examples %}
**{{ e.name }}**
{% highlight yaml %}
{{ e.code }}
{% endhighlight %}
{% endfor %}
{% endif %}

## Form-level property

| Attribute | Comments |
|-----------|----------|
| **{{ steps_prop.name }}**<br><span class="af-type">{{ steps_prop.type }}</span> | **{{ steps_prop.short }}**<br>{{ steps_prop.description | markdownify }} |

## Step properties

{{ step_object.description | markdownify }}

<table>
  <thead>
    <tr>
      <th>Attribute</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
    {% assign groups = step_object.items | map: "group" | uniq | sort_natural %}
    {% for group in groups %}
    {% assign group_properties = step_object.items  | where: "group",group %}
    {% if group %}
    <tr>
      <th id="{{ step_object.name }}_{{ group }}_group" colspan="2" class="af-group-header">
        {{ group }}
      </th>
    </tr>
    {% endif %}
    {% for var in group_properties %}
    <tr>
      <td>
        <span id="{{step_object.name}}_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
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
          <strong>Default:</strong><br>
          <span>{{ var.default }}</span>
        </div>   
        {% endif %}   
        {% if var.with_types!=nil %}
        <div>
          <strong class="af-with-types">Only available with types:</strong><br>
          <span>{{ var.with_types }}</span>
          <br><br>
        </div>
        {% endif %}                          
        {% for c in var.changelog %}
        <div class="af-changelog">
          {% if c.type == "added" %}
          <div class="af-changelog-header">
            <span class="af-badge af-badge-added">Added</span>
            <span class="af-badge af-badge-version">{{ c.version }}</span>
          </div>
          {% endif %}
          <p>
            {{ c.description | markdownify }}
          </p>
        </div>
        {% endfor %}
        {% if var.examples %}
        <p><strong>Examples:</strong></p>
        {% endif %}
        {% for e in var.examples %}
        <div>
          <p><strong>{{ forloop.index }}) {{ e.name }}</strong></p>
{% highlight yaml %}
{{ e.code }}
{% endhighlight %}
        </div>
        {% endfor %}
      </td>
    </tr>
    {% endfor %}
    {% endfor %}
    {% if step_object.examples %}          
    <tr>
      <th id="{{ step_object.name }}_examples" colspan="2">
        Examples
      </th>
    </tr>
    <tr>
      <td colspan="2">
        {% for e in step_object.examples %}
        <div>
          <p id="{{ step_object.name }}_examples_{{ forloop.index }}"><strong>{{ forloop.index }}) {{ e.name }}</strong></p>
{% highlight yaml %}
{{ e.code }}
{% endhighlight %}
        </div>
        {% endfor %}            
      </td>
    </tr>      
    {% endif %}
  </tbody>
</table>

---

## Example

Multi-step forms allow you to break complex workflows into multiple sequential pages, improving user experience and organization. Each step can have its own set of fields and validation.

### Two-Step Provisioning Form

```yaml
name: Server Provisioning
category: Setup
steps:
  - name: Basic Configuration
    fields:
      - server_name
      - environment
      - size
  - name: Network Settings
    fields:
      - ip_address
      - subnet
      - gateway
fields:
  - name: server_name
    type: text
  - name: environment
    type: select
  - name: size
    type: select
  - name: ip_address
    type: text
  - name: subnet
    type: text
  - name: gateway
    type: text
```
