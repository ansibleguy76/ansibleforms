---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Creating Tablefields
description: | 
  A tablefield is somewhat special.  It's a field of a table formfield (can you still follow ?).<br>  
  A form can have the <code>table formfield</code>.  That table has its own fields, called a tablefield.  
# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: false

# Page navigation
page_nav:
    prev:
        content: Formfields
        url: '/formfield'
    next:
        content: Expressions
        url: '/expressions'
---

{% assign help = site.data.help %}
{% assign formsyaml = help | where: "link", "forms" | first %}
{% assign form = formsyaml.help | where: "name", "Form" | first %}
{% assign formfield = form.help | where: "name", "Formfield" | first %}
{% assign tablefield = formfield.help | where: "name", "Tablefield" | first %}
{% assign type = tablefield.items | where: "name", "type" | first %}

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
          <a href="#{{ t.name }}-tablefield"><strong>{{ t.name }}</strong></a>
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
# {{ f.name }} formfield

  {% if f.version %}
  <div class="tags has-addons mb-1">
    <span class="tag is-dark">Version</span><span class="tag is-success">{{ f.version }}</span>
  </div>
  {% endif %}

  <p markdown="1">
  {{ f.description }}
  {{ f.extra }}<br>
    Below are the properties that are specifically for a {{ f.name }} tablefield
  </p>
  
  <table class="table-responsive">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          {% assign specific_properties = tablefield.items | where_exp: "item", "item.with_types contains f.name" %}
          {% assign generic_properties = tablefield.items | where_exp: "item", "item.with_types==nil" %}
          {% assign specific_properties = specific_properties | concat: generic_properties | sort_natural: "group" | sort_natural: "name" %}        
          {% assign groups = specific_properties | map: "group" | uniq | sort_natural %}
          {% for group in groups %}
          {% assign group_properties = specific_properties  | where: "group",group %}
          <tr>
            <th id="{{ f.name }}_{{ group }}_group" colspan="2" addclass="has-text-success" class="fw-bold scrollspy is-success" headinglevel="2">
              {{ group }}
            </th>
          </tr>
          {% for var in group_properties %}
          <tr>
            <td>
              <span id="{{ f.name }}_{{ var.name }}" headinglevel="3" class="scrollspy fw-bold">{{ var.name }}</span><br>
              <span class="has-text-primary">{{ var.type}}</span>
            
              {% if var.required==true %}<span class="has-text-danger"> / required</span>{% endif %}
              {% if var.unique==true %}<span v-if="f.unique" class="has-text-warning"> / unique</span>{% endif %}
              <br>
                
              {% if var.version %}<span v-if="f.version" class="is-italic has-text-success">added in version {{var.version}}</span>{% endif %}
            </td>
            <td>
              <p>
                <strong>{{ var.short }} {% if var.name=="type" %}(= {{ f.name }}){% endif %}</strong><br>
                {% if var.docsObjectLink %}
                <a href="{{ var.docsObjectLink}}"><i class="fat fa-link"></i> 
                {% endif %}
                {% if var.allowed != nil %}
                <span class="has-text-primary">{{ var.allowed }}</span>
                {% endif %}
                {% if var.docsObjectLink %}
                </a>
                {% endif %}
              </p>
              {% if var.name!="type" %}
              <p markdown="1">
                {{ var.description }}
              </p>
              {% endif%}
              {% if var.choices.size > 0 and var.name!="type" %}
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
                <span class="fw-bold has-text-danger">Only available with types:</span><br>
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
              {% if var.examples and var.name!="type" %}
              <p class="fw-bold">
                Examples:
              </p>

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
              {% endif %}              
            </td>
          </tr>
          {% endfor %}          
          {% endfor %}

        </tbody>
  </table>

{% if f.examples %}
<p class="mt-5 fw-bold" >Examples</p>
{% for e in f.examples %}
<div>
  <p class="has-text-link mt-2">{{ forloop.index }}) {{ e.name }}</p>
<div markdown="1">
```yaml
{{ e.code }}
```
</div>
</div>
{% endfor %}
{% endif %}
{% endfor %}
