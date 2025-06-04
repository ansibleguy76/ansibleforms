#!/usr/bin/python

# ==============================================================================
# DESCRIPTION
# Read excel file and create csv files
# ==============================================================================
# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
from __future__ import (absolute_import, division, print_function)
__metaclass__ = type

DOCUMENTATION = '''
module: af_datasource_excel
author: AnsibleGuy <info@ansibleguy.com>
short_description: Ansibleforms datasource query mysql to csv files
version_added: 0.0.7
description:
  - Parse excel file and create csv files
options:
  datasource:
    description:
      - The dictionary object of the datasource passed by Ansible Forms
    required: true
    type: dict

  import_path:
    description:
      - The root path of the import directory structure
    required: true
    type: str

  excel_path:
    description:
      - The path of the excel file.
    type: str
'''
EXAMPLES = """
- name: Create csv files from excel.
  ansibleguy76.ansibleforms.af_datasource_excel:
    datasource: "{{ datasource }}"
    import_path: "./datasources"
    excel_path: "./datasources/excel_files/demo.xlsx"
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
        import_path = dict(type='str', required=True),  # import path
        excel_path  = dict(type='str', required=False), # excel path
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
    import_path                        = module.params['import_path']
    excel_path                         = module.params['excel_path']

    DATASOURCE = ds.get("name")     # datasource name
    SCHEMA = ds.get("schema")       # schema name

    try:

      # Define the path to the Excel file
      excel_file_path = os.path.abspath(excel_path)

      # Read the Excel file
      excel_data = pd.ExcelFile(excel_file_path)

      # make target path
      path = os.path.join(import_path, SCHEMA, DATASOURCE)
      if not os.path.exists(path):
          os.makedirs(path)

      log(f"Reading Excel file: {excel_file_path}")
      # Iterate over each sheet in the Excel file
      for sheet_name in excel_data.sheet_names:
          # Read the sheet into a DataFrame
          df = pd.read_excel(excel_file_path, sheet_name=sheet_name)
          
          # Define the path for the CSV file
          csv_file_path = os.path.join(path, f'{sheet_name}.csv')
          
          # Save the DataFrame to a CSV file
          df.to_csv(csv_file_path, index=False, quoting=csv.QUOTE_NONNUMERIC, doublequote=True, escapechar='\\')

      # create a .ready file in the path
      with open(os.path.join(path, '.ready'), 'w') as f:
          pass

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
