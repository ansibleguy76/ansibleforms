#!/usr/bin/python

# ==============================================================================
# DESCRIPTION
# Query mysql database and create csv files
# ==============================================================================
# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
from __future__ import (absolute_import, division, print_function)
__metaclass__ = type

DOCUMENTATION = '''
module: af_datasource_query_mysql
author: AnsibleGuy <info@ansibleguy.com>
short_description: Ansibleforms datasource query mysql to csv files
version_added: 0.0.2
description:
  - Query mysql database and create csv files
options:
  datasource:
    description:
      - The dictionary object of the datasource passed by Ansible Forms
    required: true
    type: dict

  mysql_conn:
    description:
      - The credential dictionary object of the mysql connection
    required: true
    type: dict

  import_path:
    description:
      - The root path of the import directory structure
    required: true
    type: str

  query_path:
    description:
      - The path of the query files. The file name should be in the format of schema.table.sql
    type: str
'''
EXAMPLES = """
- name: Create csv files from mysql queries.
  ansibleguy76.ansibleforms.af_datasource_query_mysql:
    datasource: "{{ datasource }}"
    mysql_conn: "{{ mysql_conn }}"
    import_path: "./datasources"
    query_path: "./datasources/mysql_queries"
"""

RETURN = """

"""


from ansible.module_utils.basic import AnsibleModule
import pymysql
import os
import pandas as pd
import csv

summary=[]
result = {}

def validate_input(inputs):
    for i in inputs:
        for key in i:
            if not i[key]:
                raise Exception(f"Missing required parameter {key}")

# logging 
def log(t):
    global summary
    summary.append(t)
def debug(t):
    # log(t)
    pass
def warn(t):
    summary.append(f"WARNING: {t}")
def error(t):
    summary.append(f"ERROR: {t}")

# main code
def run_module():
    # define available arguments/parameters a user can pass to the module
    module_args = dict(
        # debug                     = dict(type='bool', required=False, default=False),
        datasource  = dict(type='dict', required=True), # vars external dict
        mysql_conn  = dict(type='dict', required=True), # mysql connection details
        import_path = dict(type='str', required=True),  # import path
        query_path  = dict(type='str', required=False), # query path
    )

    module = AnsibleModule(
        argument_spec=module_args,
        supports_check_mode=True
    )

    # store input to vars, some are global
    global summary
    global result
    
    err = None
    # debug                              = module.params['debug']

    # grab input
    ds                                 = module.params['datasource']
    mysql                              = module.params['mysql_conn']
    import_path                        = module.params['import_path']
    query_path                         = module.params['query_path']

    MYSQL_HOST = mysql.get("host")        # mysql host
    MYSQL_PORT = mysql.get("port")        # mysql port
    MYSQL_USER = mysql.get("user")        # mysql user
    MYSQL_PASSWORD = mysql.get("password")    # mysql password

    QUERY_PATH = query_path or "./datasources/mysql_queries"

    DATASOURCE = ds.get("name")     # datasource name
    SCHEMA = ds.get("schema")       # schema name

    try:

        mysql_conn = pymysql.connect(host=MYSQL_HOST, port=MYSQL_PORT, user=MYSQL_USER, password=MYSQL_PASSWORD, cursorclass=pymysql.cursors.DictCursor, ssl={"fake_flag_to_enable_tls":True})
        cursor_mysql = mysql_conn.cursor()

        # get absolute path
        query_path = os.path.join(os.path.abspath(QUERY_PATH), SCHEMA)

        for file in os.listdir(query_path):
            
            # get table name
            try:
              table,extension = file.split('.')
              if extension != 'sql':
                # wrong file format
                continue
            except:
              # wrong file format
              continue
            
            # make target path
            path = os.path.join(import_path, SCHEMA, DATASOURCE)
            if not os.path.exists(path):
                os.makedirs(path)

            # read the sql file
            with open(file, 'r') as f:
                sql = f.read()
                # replace new lines with space
                # remove \r
                sql = sql.replace('\r', '')
                sql = sql.replace('\n', ' ')

            cursor_mysql.execute(sql)
            # log(f"Processing {table}...")   
            res = cursor_mysql.fetchall()
            # write the result to a csv file with pandas
            df = pd.DataFrame(res)
            csv_path = os.path.join(path, f'{table}.csv')
            df.to_csv(csv_path, index=False, quoting=csv.QUOTE_NONNUMERIC, doublequote=True, escapechar='\\')
            # create a .ready file in the path
            with open(os.path.join(path, '.ready'), 'w') as f:
                pass
            
        cursor_mysql.close()
        mysql_conn.close()

    except Exception as e:
        log(repr(e))
        err = str(e)

    result["summary"] = summary

    # return
    if err:
        module.fail_json(err,**result)
    else:
        module.exit_json(**result)


def main():
    run_module()


if __name__ == '__main__':
    main()
