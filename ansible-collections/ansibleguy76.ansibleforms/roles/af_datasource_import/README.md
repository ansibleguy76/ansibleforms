af_datasource_import
=========

Import csv files into a MySql Database

Requirements
------------

- pymysql
- jinja2
- pandas
- csv

Role Variables
--------------
```
datasource: { id:1, name: mydatasource, schema: myschema } # is passed from Ansible Forms
import_mysql_conn: { host: myhost, port: 3306, user: root, password: dummy, database: AnsibleForms } # target credentials, is passed from Ansible Forms credential
af_datasource_import_force: false # import even with missing .ready file
af_datasource_import_keep: false  # keep csv files after import
import_path: <relative path to playbook for import structure>
```
Dependencies
------------

Example Playbook
----------------
```
---
- hosts: localhost
  collections:
    - ansibleguy76.ansibleforms
  vars_files:
    - globals.yml
  roles:
  - af_datasource_query_mysql  # creates the csv files
  - af_datasource_import       # imports the csv files
```

I use a globals file to hold my variables.
```
import_path: ./datasources
query_path: ./datasources/mysql_queries
# datasource & mysql_conn is passed from AnsibleForms
```

License
-------

GNU v3

Author Information
------------------
AnsibleGuy
https://ansibleforms.com