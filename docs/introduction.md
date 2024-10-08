---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Introduction
description: |
    Ansible is a great automation tool, but in the end, it's still a command-line application.  
    While AWX/Tower is a great GUI, it is lacking fancy forms that can grab data from several sources.<br><br>  
      
    That's where AnsibleForms comes in.  It allows you to build awesome forms, build extravars and send it to Ansible or AWX/Tower.

# Micro navigation
micro_nav: true

# Page navigation
page_nav:
    prev:
        content: Home
        url: '/index'
    next:
        content: Installation
        url: '/installation'
---



# Application Capabilities

* **Categories** : Group multiple forms under categories
* **Role based access** : Limit forms based on roles (users and groups)
* **Advanced authentication** : Local authentication, Ldap and AzureAD authentication
* **Job History & Log** : See the history of your jobs, abort running and relaunch
* **Environment variables** : Customizable with environment variables
* **Credential manager** : Securily store, get and pass credentials to playbooks
* **Repository integration** : Sync your forms config files, ansible playbooks and other required files with a git repo
* **Ansible and AWX** : Forms can target a local ansible instance or AWX/Tower
* **Swagger API** : Has a rest-api and Swagger documentation
* **Job History & Log** : See the history of your jobs* 
* **Designer** : Although the forms are NOT built using a graphical designer, a YAML based editor/designer with validation is present
* **Git integration** : Sync your forms config files, ansible playbooks and other required files with a git repo

# Form Capabilities

* **Categories** : Group multiple forms under categories
* **Role based access** : Limit forms based on roles
* **Cascaded dropdowns** : Allow references between fields to create responsive, cascaded dropdown boxes
* **Database sources** : Import data into fields from databases (MySql, MSSql, Postgres, Mongo, Oracle)
* **Expression based sources** : Import data using serverside expressions (javascript), such as Rest API's, json-files, yaml-files, ... and filter, manipulate and sort them
* **Local expressions** : Use the power of javascript (local browser sandbox) to calculate, manipulate, generate, ... 
* **Field dependencies** : Show/hide fields based on values of other fields
* **Visualization** : Many nice visualizations, such as icons, images, colors, responsive grid-system, help descriptions, ...
* **Field validations** : Many types of field validations, such min,max,regex,in, ...
* **Group fields** : Group fields together, vertically and horizontally
* **Advanced output modelling** : Model your form content into objects, the way you want it
* **Approval points** : Stop the execution of a form for approval
* **Multistep forms** : Execute multiple playbooks in steps from a single form
* **Email notifications** : Send email notifications after form execution

# Types of Form Fields

{% assign formfile = site.data.help[1].help[2].help[1].items[1] %}
<ul>
{% for type in formfile.choices %}
<li><strong>{{ type.name }}</strong> : {{ type.description }}</li>
{% endfor %}
</ul>

# Used Technologies

* **Backend** : Nodejs / Express
* **Database** : MySql
* **Frontend** : Vue2
* **Layout** : Bulma / font-awesome

# Requirements

<div class="callout callout--warning">
    <p><strong>Requirements depend on how you plan to install AnsibleForms.</strong> <a href="{% if jekyll.environment == 'production' %}{{ site.doks.baseurl }}{% endif %}/installation">See the installation section to learn more.</a></p>
</div>

