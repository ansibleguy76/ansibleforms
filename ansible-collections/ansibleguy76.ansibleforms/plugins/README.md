# Modules

- af_datasource_import
- af_datasource_query_mysql

## af_datasource_import

Imports csv files into a database schema.  
It has the following properties:

- **datasource**: The datasource `dict` that is passed by Ansible Forms
- **import_path**: The root `path` for the structure of the csv files
- **mysql_conn**: The mysql `credentials` dict that is passed by Ansible Forms
- **force**: A `boolean` flag to ignore the `.ready` file (default: false)
- **keep**: A `boolean` flag to keep the csv files after import (default: false)

### datasource dict

- **id**: id of the datasource
- **name**: Name of the datasource
- **schema**: Name of the schema

### mysql_conn credentials dict

- **host**: Mysql host
- **port**: Mysql port (3306)
- **user**: Mysql username
- **password**: Mysql password
- **database**: Mysql database (AnsibleForms)

### folder structure

The below folder structure must be used

```
{import_path}
└── {schema_name}
    └── {datasource_name}
        ├── table1.csv
        ├── table2.csv
        ├── ...
        └── .ready
```

### csv file requirements

- **headers**: yes (must hold fieldname in first line)
- **record-separator**: newline (LF or CRLF)
- **field-sepeartor**: comma
- **quoted**: yes (double quotes)
- **escaped**: backslash
- **charset**: utf-8

**Notes** :  
When you have relations between tables, the foreignkey-field-values must match the value of the id-field in the csv-file of the referencing table.  
When you don't have relations you may omit the `id` field.


```
categories.csv : the 'id' must be added, because it's referenced by the table 'products'

"id","name"
1,"food"
2,"electronics"
3,"cosmetics"

products.csv : the 'id' can be omitted, it is not referenced

"name","category_id"
"sandwich",1
"chocolate",1
"computer",2
"phone",2
"shampoo",3
"eyeliner",3
```

## af_datasource_query_mysql

Creates csv files by querying mysql.  
Processes sql files in a path of the format {schema}.{table}.sql.  

Use in combination with af_datasource_import.  Once module creates the csv files, the other module imports them.

It has the following properties:

- **datasource**: The datasource `dict` that is passed by Ansible Forms
- **import_path**: The root `path` for the structure of the csv files
- **mysql_conn**: The mysql `credentials` dict for the source queries that is passed by Ansible Forms
- **query_path**: The root `path` for the mysql query files

### folder structure

The below file structure must be used

```
{query_path}
├── {schema_name}.table1.sql
├── {schema_name}.table2.sql
└── ...
```

### datasource dict

- **id**: id of the datasource
- **name**: Name of the datasource
- **schema**: Name of the schema

### mysql_conn credentials dict

- **host**: Mysql host
- **port**: Mysql port (3306)
- **user**: Mysql username
- **password**: Mysql password
- **database**: Mysql database (AnsibleForms)