---
layout: default
title: Environment Variables
nav_order: 3
---

# Environment Variables
{: .no_toc }

{% assign help = site.data.help %}
{% assign env_vars = help | where: "link", "environment-variable" | first %}

{{ env_vars.description | markdownify }}

---



## Variables

<table>
  <thead>
    <tr>
      <th>Variable</th>
      <th>Choices/Defaults</th>
      <th>Comments</th>
    </tr>
  </thead>
  <tbody>
{% for var in env_vars.items %}
    <tr>
      <td>
        <span id="env_{{ var.name }}"><strong>{{ var.name }}</strong></span><br>
        <span class="af-type">{{ var.type}}</span>
        {% if var.required==true %}<span class="af-required"> / required</span>{% endif %}
        {% if var.unique==true %}<span class="af-unique"> / unique</span>{% endif %}
        <br>
        {% if var.version %}<span class="af-version">added in version {{var.version}}</span>{% endif %}
      </td>
      <td>
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
      </td>
      <td>
        <p>
          <strong>{{var.short}}</strong><br>
          {% if var.allowed != nil %}
          <span class="af-type">{{ var.allowed }}</span>
          {% endif %}
        </p>
        <p>
          {{ var.description | markdownify | markdownify }}
        </p>
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
        {% if var.example != nil %}
        <p>
          <strong>Examples:</strong><br>
          <code>{{ var.example }}</code>
        </p>
        {% endif %}
      </td>
    </tr>
{% endfor %}
  </tbody>
</table>

