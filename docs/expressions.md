---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Using expressions
description: | 
  Make advanced forms with expressions
# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: false

# Page navigation
page_nav:
    prev:
        content: Learn more about formfields
        url: '/formfield'
    next:
        content: FAQ
        url: '/faq'
---

{% assign help = site.data.help %}
{% assign expression = help | where: "link", "expressions" | first %}
{% assign expressions = expression.help %}

The `expression` formfield-attribute is so powerfull, more examples are important. 
The expression attribute can be used on an :  
- `enum` field, to fill the dropdown
- `expression` field, to grab or maka any for of data
- `table` field, to fill the table field  

This javascript is evaluated either on the server side (default) or on the client side using the field property `runLocal`

[**On the server side**](/#local-expressions), the code is limited to pre-defined functions, mainly to get external data.  
[**On the client side**](/#remote-expressions), the code is unlimited, yet some pre-defined filter and sorting functions are available to make life easier.
  
**Security Concerns** : Since expressions are evaluated using javascripts eval function, there can be a concern for code injection.  Therefor, server side expressions are limited to predefined functions, no code injection is possible.  On the client side, the code is evaluated in the sandbox of the browser and can be considered safe.  


{% for ex in expressions %}

# {{ ex.name }}

<div markdown="1">
{{ ex.description }}
</div>


{% assign examples = ex.examples %}
{% for e in examples %}
## {{ e.name }}

{% if e.code %}

{{ e.description }}

```{{ e.language | default: "javascript" }}
{{ e.code }}
```

{% endif %}

{% endfor %}

{% endfor %}