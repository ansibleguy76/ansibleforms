---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Creating forms
description: | 
  Once you understand the <code>forms.yaml</code> structure, you can now focus on the forms part.<br>
  You can choose to either put all the forms in the master forms.yaml file, or you can create several yaml files under the <code>/forms</code> folder.<br>
  AnsibleForms will read them all and merge them together.
# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: false

# Page navigation
page_nav:
    prev:
        content: Forms configuration
        url: '/forms'
    next:
        content: Learn more about formfields
        url: '/formfield'
---

{% assign help = site.data.help %}
{% assign formsyaml_list = help | where: "link", "forms" %}
{% assign formsyaml = formsyaml_list[0] %}
{% assign form_list = formsyaml.help | where: "name", "Form" %}
{% assign form = form_list[0] %}
{% assign objects = form.help %}
{% assign type_list = form.items | where: "name", "type" %}
{% assign type = type_list[0] %}


# Possible form types / Examples

<!-- type links -->
<div class="mb-5">
  <table class="table">
    <thead>
      <tr class="fw-bold">
        <td>Type</td>
        <td>Description</td>
      </tr>
    </thead>
    <tbody>
      {% for t in type.choices %}
      <tr>
        <td>
          <a href="#{{ t.name }}-form"><strong>{{ t.name }}</strong></a>
        </td>
<td markdown="1">
{{ t.description }}
</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
</div>

{% for f in type.choices %} 
## {{ f.name }} Form

  {% if f.version %}
  <div class="tags has-addons mb-1">
    <span class="tag is-dark">Version</span><span class="tag is-success">{{ f.version }}</span>
  </div>
  {% endif %}

  <p markdown="1">
  {{ f.description }}
  {{ f.extra }}<br>
    Below are the properties that are specifically for a {{ f.name }} Form
  </p>
  
{% assign specific_properties = form.items | where_exp: "item", "item.with_types contains f.name" %}

  <table class="table-responsive">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          {% for var in specific_properties %}
          <tr>
            <td>
              <span id="{{ f.name }}_{{ var.name }}" headinglevel="2" class="scrollspy fw-bold">{{ var.name }}</span><br>
              <span class="has-text-primary">{{ var.type}}</span>
            
              {% if var.required==true %}<span class="has-text-danger"> / required</span>{% endif %}
              {% if var.unique==true %}<span v-if="f.unique" class="has-text-warning"> / unique</span>{% endif %}
              <br>
                
              {% if var.version %}<span v-if="f.version" class="is-italic has-text-success">added in version {{var.version}}</span>{% endif %}
            </td>
            <td>
              <p>
                <strong>{{var.short}}</strong><br>
                {% if var.allowed != nil %}
                <span class="has-text-primary">{{ var.allowed }}</span>
                {% endif %}
              </p>
              <p markdown="1">
                {{ var.description }}
              </p>
              {% if var.choices.size > 0 %}
              <div class="">
                <span class="fw-bold">Choices:</span><br>
                <ul>
                  {% for c in var.choices %}
                  <li>
                    {% if c.name == var.default %}
                    <span title="{{ c.description }}" class="has-text-info">{{ c.name }} (default)</span>
                    {% else %}
                    <span title="{{ c.description }}">{{ c.name }}</span>
                    {% endif %}
                  </li>
                  {% endfor %}
                </ul>
              </div>
              {% elsif var.default != nil %}               
              <div>
                <span class="fw-bold">Default:</span><br>
                <span class="">{{ var.default }}</span>
              </div>   
              {% endif %}   
              {% if var.with_types!=nil %}
              <div>
                <span class="fw-bold">Only available with types:</span><br>
                <span class="">{{ var.with_types }}</span>
                <br><br>
              </div>
              {% endif %}                          
              {% for c in var.changelog %}
              <div class="callout callout--info">
                {% if c.type == "added" %}
                <div class="tags has-addons mb-1">
                  <span class="tag is-dark">Added</span><span class="tag is-success">{{ c.version }}</span>
                </div>
                {% endif %}
                <p markdown="1">
                  {{ c.description }}
                </p>
              </div>
              {% endfor %}
              {% if var.example != nil %}
              <p class="fw-bold">
                Examples:
              </p>
              {% endif %}
              {% for e in var.examples %}
            <div>
              <p class="fw-bold mt-2">{{ forloop.index }}) {{ e.name }}</p>

<div markdown="1">
```yaml
{{ e.code }}
```
</div>

            </div>
              {% endfor %}
            </td>
          </tr>
          {% endfor %}
        </tbody>
  </table>

{% if f.examples %}
<p class="mt-5 fw-bold" >Examples</p>
{% for e in f.examples %}
<div>
  <p class="has-text-link mt-2">{{ forloop.index +1 }}) {{ e.name }}</p>
<div markdown="1">
```yaml
{{ e.code }}
```
</div>
</div>
{% endfor %}
{% endif %}
{% endfor %}

{% for f in objects %}
# {{ f.name }} Object

{{ f.description }}

<table class="table-responsive">
      <thead>
        <tr>
          <th>Attribute</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
{% for var in f.items %}
        <tr>
          <td>
            <span id="{{f.name}}_{{ var.name }}" headinglevel="2" class="scrollspy fw-bold">{{ var.name }}</span><br>
            <span class="has-text-primary">{{ var.type}}</span>
          
            {% if var.required==true %}<span class="has-text-danger"> / required</span>{% endif %}
            {% if var.unique==true %}<span v-if="f.unique" class="has-text-warning"> / unique</span>{% endif %}
            <br>
              
            {% if var.version %}<span v-if="f.version" class="is-italic has-text-success">added in version {{var.version}}</span>{% endif %}
          </td>
          <td>
            <p>
              <strong>{{var.short}}</strong><br>
              {% if var.allowed != nil %}
              <span class="has-text-primary">{{ var.allowed }}</span>
              {% endif %}
            </p>
            <p markdown="1">
              {{ var.description }}
            </p>
            {% if var.choices.size > 0 %}
            <div class="">
              <span class="fw-bold">Choices:</span><br>
              <ul>
                {% for c in var.choices %}
                <li>
                  {% if c.name == var.default %}
                  <span title="{{ c.description }}" class="has-text-info">{{ c.name }} (default)</span>
                  {% else %}
                  <span title="{{ c.description }}">{{ c.name }}</span>
                  {% endif %}
                </li>
                {% endfor %}
              </ul>
            </div>
            {% elsif var.default != nil %}               
            <div>
              <span class="fw-bold">Default:</span><br>
              <span class="">{{ var.default }}</span>
            </div>   
            {% endif %}   
            {% if var.with_types!=nil %}
            <div>
              <span class="fw-bold">Only available with types:</span><br>
              <span class="">{{ var.with_types }}</span>
              <br><br>
            </div>
            {% endif %}                          
            {% for c in var.changelog %}
            <div class="callout callout--info">
              {% if c.type == "added" %}
              <div class="tags has-addons mb-1">
                <span class="tag is-dark">Added</span><span class="tag is-success">{{ c.version }}</span>
              </div>
              {% endif %}
              <p markdown="1">
                {{ c.description }}
              </p>
            </div>
            {% endfor %}
            {% if var.example != nil %}
            <p class="fw-bold">
              Examples:
            </p>
            {% endif %}
            {% for e in var.examples %}
            <div>
              <p class="fw-bold mt-2">{{ forloop.index }}) {{ e.name }}</p>

<div markdown="1">
```yaml
{{ e.code }}
```
</div>

            </div>
            {% endfor %}
          </td>
        </tr>
{% endfor %}
      </tbody>
</table>
{% endfor %}


