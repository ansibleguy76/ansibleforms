af_datasource_query_mysql
=========

Create csv files from parsing excel file

Requirements
------------

- openpyxl
- pandas
- csv

Role Variables
--------------
```
datasource: { id:1, name: mydatasource, schema: myschema } # is passed from Ansible Forms
import_path: <relative path to playbook for import structure>
excel_path: <relative path to playbook of excel file>
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
  - af_datasource_excel        # creates the csv files
  - af_datasource_import       # imports the csv files
```

I use a globals file to hold my variables.
```
import_path: ./datasources
excel_path: ./datasources/excel_files/myexcel.xlsx
# datasource is passed from AnsibleForms
```

License
-------

GNU v3

Author Information
------------------
AnsibleGuy
https://ansibleforms.com