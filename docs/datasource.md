---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Datasources
description: | 
  Import data in to your custom schemas
# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: false

# Page navigation
page_nav:
    prev:
        content: Schemas
        url: '/schema'
    next:
        content: GUI
        url: '/gui'
---

# Datasources

## Concept and Goal

In Ansible Forms, it's sometimes handy to have some custom databases.  
Since version 5.0.9 you can now create them with yaml.  (see schemas).
  
Datasources give you the option to import data into those schemas.  
You can have multiple datasources for the same schema.  

## Csv files and Marker file

The import process is done with CSV-files.  Each csv file represents a table.  
After the CSV files have been created you can add a `.ready` file as a sign the CSV files are ready.  
The files need to be created in a specific folder structure.  

```
{import_path}
└── {schema_name}
    └── {datasource_name}
        ├── table1.csv
        ├── table2.csv
        ├── ...
        └── .ready
```

CSV-file format:

- **headers**: yes (must hold fieldname in first line)
- **record-separator**: newline (LF or CRLF)
- **field-sepeartor**: comma
- **quoted**: yes (double quotes)
- **escaped**: backslash
- **charset**: utf-8

To cover inter-table-relations, you must ensure the foreign-keys (`xxx_id`) match the primary key (`id`).  However, if no relations are present, you may omit the `id` column.  
  
## Custom Datasource Module

To import the CSV files into the schema, we provide a custom module `ansibleguy76.ansibleforms.af_datasource_import`.  
It has the following properties:

- **datasource**: The datasource `dict` that is passed by Ansible Forms.
- **import_path**: The root `path` for the structure of the csv files
- **mysql_conn**: The mysql `credentials` dict that is passed by Ansible Forms.  Use the credential `\_\_self\_\_`, this will inject the mysql connection credential.
- **force**: A `boolean` flag to ignore the `.ready` file (default: false)
- **keep**: A `boolean` flag to keep the csv files after import (default: false)

Example :
```yaml
- name: Import csv files.
  ansibleguy76.ansibleforms.af_datasource_import:
    datasource: "{{ datasource }}"             # datasource is auto injected by ansibleforms
    mysql_conn: "{{ import_mysql_conn }}"      # you can have ansibleforms inject these credentials
    import_path: "./datasources"               # relative patch from the playbook, add it as an extravar if you want
    force: false
    keep: false
```

## Playbook

You will need to create your own playbook to cover the data-collection.  However, the Ansible Forms Docker project will provide a few examples.  
And Ansible Forms comes with a role and module to cover the import.  
  
Example 1 :

- the first role will create csv files by querying another mysql server
- the second role will import them

```yaml
---
- name: "Import datasource"
  hosts: localhost
  become: false
  gather_facts: false
  collections:
    - ansibleguy76.ansibleforms # install with ansible-galaxy install ansibleguy76.ansibleforms (already part of docker project)
  roles:
    - af_datasource_query_mysql # this role creates csv files from mysql queries (.sql files)
    - af_datasource_import      # this role picks up the csv files and imports them


#--------------------------------------
# the extravars passed in this example
#--------------------------------------
datasource:   # passed by Ansible Forms
  id: 2
  name: my_datasource
  schema: my_schema

import_mysql_conn:  # credential of target passed by Ansible Forms (using credential __self__)
  host: af_host
  port: 3306
  user: root
  password: mypass

query_mysql_conn:  # credential of source passed by Ansible Forms (see how to pass credentials) - 
  host: my_source_host
  port: 3306
  user: admin
  password: mypass

import_path: "./datasources"
query_path : "./datasources/mysql_queries" # contains .sql files, 1 per table to query
```

## Cron Schedule

Using the cron-field, you can have a cron-schedule that allows scheduled imports.

