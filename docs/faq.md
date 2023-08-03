---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Frequently Asked Questions
description: | 
  More information and examples
# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: false

# Page navigation
page_nav:
    prev:
        content: Expressions
        url: '/expressions'
    next:
        content: The GUI
        url: '/gui'        
---

{% assign help = site.data.help %}
{% assign faq = help | where: "name", "FAQ" | first  %}
{% assign examples = faq.examples %}

[//]: # start loop examples
{% for e in examples %}
## {{ e.short | default: e.name }}

[//]: # show version if any
{% if e.version %}
<div class="tags has-addons mb-1">
  <span class="tag is-dark">Version</span><span class="tag is-success">{{ e.version }}</span>
</div>
{% endif %}

{{ e.description }}

[//]: # show code if any
{% if e.code %}
```{{ e.language | default: "javascript" }}
{{ e.code }}
```

{% endif %}

[//]: # end examples loop
{% endfor %} 
