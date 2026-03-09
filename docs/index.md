---
layout: default
title: Introduction
nav_order: 1
description: "AnsibleForms - Build awesome forms for Ansible automation"
permalink: /
---

# Introduction
{: .fs-9 }

Ansible is a great automation tool, but in the end, it's still a command-line application.  
While AWX/Tower is a great GUI, it is lacking fancy forms that can grab data from several sources.

That's where AnsibleForms comes in. It allows you to build awesome forms, build extravars and send it to Ansible or AWX/Tower.
{: .fs-6 .fw-300 }

---

## Quick Navigation
{: .no_toc }

Get up and running quickly with AnsibleForms:

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin: 2rem 0; align-items: stretch;">
  <div class="quick-nav-card">
    <h3>🚀 How to Install</h3>
    <p>Get AnsibleForms running in minutes with Docker or manual setup</p>
    <a href="installation" class="btn btn-primary">Installation Guide</a>
  </div>
  <div class="quick-nav-card">
    <h3>⚙️ How to Customize</h3>
    <p>Configure AnsibleForms with environment variables</p>
    <a href="customization" class="btn btn-blue">Environment Variables</a>
  </div>
  <div class="quick-nav-card">
    <h3>📝 Setup config.yaml</h3>
    <p>Define roles, categories, and access control</p>
    <a href="config" class="btn btn-green">Roles & Categories</a>
  </div>
  <div class="quick-nav-card">
    <h3>📋 Build Your First Form</h3>
    <p>Create powerful forms with fields, validations, and data sources</p>
    <a href="forms" class="btn btn-purple">Forms Documentation</a>
  </div>
</div>

---

## Application Capabilities

<table>
  <thead>
    <tr>
      <th style="width: 25%;">Feature</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Categories</strong></td>
      <td>Group multiple forms under categories</td>
    </tr>
    <tr>
      <td><strong>Role based access</strong></td>
      <td>Limit forms based on roles (users and groups)</td>
    </tr>
    <tr>
      <td><strong>Advanced authentication</strong></td>
      <td>Local authentication, Ldap, AzureAD and OIDC authentication</td>
    </tr>
    <tr>
      <td><strong>Job History & Log</strong></td>
      <td>See the history of your jobs, abort running and relaunch</td>
    </tr>
    <tr>
      <td><strong>Environment variables</strong></td>
      <td>Customizable with environment variables</td>
    </tr>
    <tr>
      <td><strong>Credential manager</strong></td>
      <td>Securely store, get and pass credentials to playbooks</td>
    </tr>
    <tr>
      <td><strong>Repository integration</strong></td>
      <td>Sync your forms config files, ansible playbooks and other required files with a git repo</td>
    </tr>
    <tr>
      <td><strong>Ansible and AWX</strong></td>
      <td>Forms can target a local ansible instance or AWX/Tower</td>
    </tr>
    <tr>
      <td><strong>Swagger API</strong></td>
      <td>Has a rest-api and Swagger documentation</td>
    </tr>
    <tr>
      <td><strong>Designer</strong></td>
      <td>Although the forms are NOT built using a graphical designer, a YAML based editor/designer with validation is present</td>
    </tr>
  </tbody>
</table>

## Form Capabilities

<table>
  <thead>
    <tr>
      <th style="width: 25%;">Feature</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Cascaded dropdowns</strong></td>
      <td>Allow references between fields to create responsive, cascaded dropdown boxes</td>
    </tr>
    <tr>
      <td><strong>Database sources</strong></td>
      <td>Import data into fields from databases (MySql, MSSql, Postgres, Mongo, Oracle)</td>
    </tr>
    <tr>
      <td><strong>Expression based sources</strong></td>
      <td>Import data using serverside expressions (javascript), such as Rest API's, json-files, yaml-files, ... and filter, manipulate and sort them</td>
    </tr>
    <tr>
      <td><strong>Local expressions</strong></td>
      <td>Use the power of javascript (local browser sandbox) to calculate, manipulate, generate, ...</td>
    </tr>
    <tr>
      <td><strong>Field dependencies</strong></td>
      <td>Show/hide fields based on values of other fields</td>
    </tr>
    <tr>
      <td><strong>Visualization</strong></td>
      <td>Many nice visualizations, such as icons, images, colors, responsive grid-system, help descriptions, ...</td>
    </tr>
    <tr>
      <td><strong>Field validations</strong></td>
      <td>Many types of field validations, such min,max,regex,in, ...</td>
    </tr>
    <tr>
      <td><strong>Group fields</strong></td>
      <td>Group fields together, vertically and horizontally</td>
    </tr>
    <tr>
      <td><strong>Advanced output modelling</strong></td>
      <td>Model your form content into objects, the way you want it</td>
    </tr>
    <tr>
      <td><strong>Approval points</strong></td>
      <td>Stop the execution of a form for approval</td>
    </tr>
    <tr>
      <td><strong>Multistep forms</strong></td>
      <td>Execute multiple playbooks in steps from a single form</td>
    </tr>
    <tr>
      <td><strong>Email notifications</strong></td>
      <td>Send email notifications after form execution</td>
    </tr>
  </tbody>
</table>

## Types of Form Fields

<table>
  <thead>
    <tr>
      <th style="width: 25%;">Field Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
{% assign formfile = site.data.help[1].help[2].help[1].items[1] %}
{% for type in formfile.choices %}
    <tr>
      <td><strong>{{ type.name }}</strong></td>
      <td>{{ type.description }}</td>
    </tr>
{% endfor %}
  </tbody>
</table>

## Used Technologies

<table>
  <thead>
    <tr>
      <th style="width: 25%;">Component</th>
      <th>Technology</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Backend</strong></td>
      <td>Node.js / Express</td>
    </tr>
    <tr>
      <td><strong>Database</strong></td>
      <td>MySQL</td>
    </tr>
    <tr>
      <td><strong>Frontend</strong></td>
      <td>Vue 3</td>
    </tr>
    <tr>
      <td><strong>Layout</strong></td>
      <td>Bootstrap 5 / Font Awesome</td>
    </tr>
  </tbody>
</table>

## Requirements

{: .warning }
> **Requirements depend on how you plan to install AnsibleForms.** [See the installation section to learn more.](installation)
