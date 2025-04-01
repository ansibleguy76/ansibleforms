#!/usr/bin/python

# ==============================================================================
# DESCRIPTION
# Import module to import datasources from csvfiles into Ansible Forms schema
# ==============================================================================
# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
from __future__ import (absolute_import, division, print_function)
__metaclass__ = type

DOCUMENTATION = '''
module: af_datasource_import
author: AnsibleGuy <info@ansibleguy.com>
short_description: Ansibleforms datasource import module
version_added: 0.0.1
description:
  - Import csv files into a mysql database
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

  force:
    description:
      - Ignore missing .ready file and force import
    type: bool

  keep:
    description:
      - Keep the csv files after import
    type: bool

  hash_ids:
    description:
      - Hash the id's in the csv files (in case the id's and foreign keys are strings)
    type: bool

'''
EXAMPLES = """
- name: Import csv files.
  ansibleguy76.ansibleforms.af_datasource_import:
    datasource: "{{ datasource }}"
    mysql_conn: "{{ mysql_conn }}"
    import_path: "./datasources"
    force: false
    keep: false
    hash_ids: false
"""

RETURN = """

"""


from ansible.module_utils.basic import AnsibleModule
import re
import jinja2
import pymysql
import os
import pandas as pd
import csv
import datetime

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

# ==============================================================================
# COMMON FUNCTIONS
# ==============================================================================
def get_csv_import_path(import_path, schema, datasource):
    file_path = os.path.join(import_path, schema, datasource)
    return file_path
def get_csv_path(csv_import_path, table):
    return os.path.join(csv_import_path, f"{table}.csv")
def get_datasource_schema(cursor_mysql, datasourcer_schema, datasource):
    sql = f"SELECT `schema` FROM {datasourcer_schema}.datasource WHERE name='{datasource}';"
    result = execute_sql(cursor_mysql, sql, fetchone=True)
    if result is None:
        raise Exception(f"Datasource {datasource} not found")
    return result[0]
def get_datasource_id(cursor_mysql, datasourcer_schema, datasource, schema):
    sql = f"SELECT id FROM {datasourcer_schema}.datasource WHERE {datasourcer_schema}.datasource.name='{datasource}' AND {datasourcer_schema}.datasource.schema='{schema}';"
    result = execute_sql(cursor_mysql, sql, fetchone=True)
    if result is None:
        raise Exception(f"Datasource {datasource} not found for {schema}")
    return result[0]
def get_datasource_config(cursor_mysql,ds,datasourcer_schema, import_path):
    absolute_import_path = os.path.abspath(import_path)
    datasource = ds["name"]
    schema = ds["schema"]
    datasource_id = ds["id"]
    csv_import_path = get_csv_import_path(absolute_import_path, schema, datasource)
    schema_file = os.path.join(absolute_import_path, schema,"schema.sql")
    tables, foreign_keys, unique_constraints, table_info = collect_table_info(cursor_mysql, schema)    # collect table info    
    datasource_config = {
        "schema": schema,
        "datasource": datasource,
        "datasourcer_schema": datasourcer_schema,
        "datasource_id": datasource_id,
        "tables": tables,
        "foreign_keys": foreign_keys,
        "unique_constraints": unique_constraints,
        "table_info": table_info,
        "csv_import_path": csv_import_path,
        "schema_file": schema_file
    }
    return datasource_config
def get_datasourcer_schema_sql(datasourcer_schema):
    init = jinja2.Environment(loader=jinja2.FileSystemLoader("my_library/templates")).get_template("init.sql.j2")
    sql = init.render({ "datasourcer_schema": datasourcer_schema })
    return sql

# ==============================================================================
# MySQL functions
# ==============================================================================
def mysql_escape_string(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")
def open_database(host, port, user, password):
    mysql_conn = pymysql.connect(host=host, port=port, user=user, password=password, autocommit=False, local_infile=True,ssl={"fake_flag_to_enable_tls":True})
    debug("Connected to the MySQL database")
    cursor_mysql = mysql_conn.cursor()
    return mysql_conn, cursor_mysql
def close_database(mysql_conn):
    mysql_conn.close()
    debug("Disconnected from the MySQL database")
def start_transaction(mysql_conn):
    debug("Starting transaction")
    mysql_conn.begin()
def commit(mysql_conn):
    debug("Committing")
    mysql_conn.commit()
def rollback(mysql_conn):
    warn("Rolling back")
    mysql_conn.rollback()
def execute_multiple_line(cursor_mysql, sql):
    # split on newlines
    sqls = sql.replace("\r", "").split("\n")
    block = ""
    for line in sqls:
        if line.startswith("--"):
            continue
        if line.startswith(r"/*"):
            continue
        line = line.strip()
        if line == "":
            continue
        block += line
        if line.endswith(";"):
            # replace newlines with spaces
            block = block.replace("\n", " ")
            block = block.replace("\r", " ")
            execute_sql(cursor_mysql, block)
            block = ""
def execute_sqlfile(cursor_mysql, sqlfile):
    with open(sqlfile, "r") as f:
        sqls = f.read()
    f.close()
    execute_multiple_line(cursor_mysql, sqls)
def execute_sql(cursor_mysql, sql, fetchone=False, fetchall=False):
    debug(sql)
    execute_result = cursor_mysql.execute(sql)
    if fetchone:
        return cursor_mysql.fetchone()
    if fetchall:
        return cursor_mysql.fetchall()
    return execute_result
def disable_foreign_key_checks(cursor_mysql):
    execute_sql(cursor_mysql, "SET FOREIGN_KEY_CHECKS = 0;")
    execute_sql(cursor_mysql, "SET UNIQUE_CHECKS = 0;")
def enable_foreign_key_checks(cursor_mysql):
    execute_sql(cursor_mysql, "SET FOREIGN_KEY_CHECKS = 1;")
    execute_sql(cursor_mysql, "SET UNIQUE_CHECKS = 1;")
def set_global_local_infile(cursor_mysql):
    sql = "SET GLOBAL local_infile = 1;"
    execute_sql(cursor_mysql, sql)
def set_allow_invalid_dates(cursor_mysql):
    sql = "SET sql_mode = 'ALLOW_INVALID_DATES';"
    execute_sql(cursor_mysql, sql)
def schema_exists(cursor_mysql, schema):
    sql = f"SELECT schema_name FROM information_schema.schemata WHERE schema_name = '{schema}';"
    result = execute_sql(cursor_mysql, sql, fetchone=True)
    return bool(result)
def find_fk_action(fk):

    FK_ACTIONS = {
        "cascade": "CASCADE",
        "set_null": "SET NULL",
        "restrict": "RESTRICT",
        "no_action": "NO ACTION"
    }

    delete_match = re.search(r"delete_([a-z_]+)", fk)
    update_match = re.search(r"update_([a-z_]+)", fk)
    delete_action = "NO ACTION"
    update_action = "NO ACTION"
    if delete_match:
        delete_action = FK_ACTIONS.get(delete_match.group(1))
    if update_match:
        update_action = FK_ACTIONS.get(update_match.group(1))
    return delete_action, update_action
def get_schema_sql_from_yaml(schema, data):

    tables = []

    for table_name in data:
        
        table = {}
        # build list of unique keys from data[table_name] keys where unique = true
        unique_keys = [column["name"] for column in data[table_name] if column.get("unique", False)]
        foreign_keys = [ column for column in data[table_name] if column.get("foreign_key", False)]
        foreign_keys_names = [fk["name"] for fk in foreign_keys]
        table["name"] = table_name
        table["unique_key"] = False
        table["foreign_keys"] = []
        table["indexes"] = []
        table["columns"] = []

        for column in data[table_name]:

            c = ""

            # if no type is given, default to varchar(255)
            col_name = column.get("name", column)
            col_type = column.get("type", "varchar").lower()
            col_length = column.get("length", 255 if col_type == "varchar" else None)
            col_default = column.get("default", None)
            col_nullable = column.get("nullable", True)
            col_case_sensitive = column.get("case_sensitive", False)

            # if col_name in foreign_keys add _id
            if col_name in foreign_keys_names:
                col_name = f"{col_name}_id"
                col_type = "int"
                col_length = None

            # string -> varchar
            if col_type == "string":
                col_type = "varchar"

            if col_type == "bool":
                col_default = 1 if bool(col_default) else 0

            # type to TYPE(LENGTH)
            if col_length:
                col_type_length = f"{col_type}({col_length})".upper()
            else:
                col_type_length = col_type.upper()

            c = f"`{col_name}` {col_type_length}"

            if col_case_sensitive:
                c = f"{c} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"

            # correct defaults
            if col_default:

                if col_type in ["date", "datetime", "timestamp"] and col_default.lower() == "current_timestamp":
                    c = f"{c} DEFAULT CURRENT_TIMESTAMP"

                elif col_type in ["int", "bigint", "tinyint", "smallint", "mediumint", "decimal", "float", "double"]:
                    c = f"{c} DEFAULT {col_default}"

                else:
                    c = f"{c} DEFAULT '{col_default}'"

            elif not col_nullable:
                c = f"{c} NOT NULL"
            else:
                c = f"{c} DEFAULT NULL"

            if "comment" in column:
                c = f"{c} COMMENT '{column['comment']}'"

            table["columns"].append(c)

        # UNIQUE KEY `uk_cm_storage_aggregate_natural_key` (`name`,`node_id`),
        if bool(unique_keys):
            table["unique_key"] = f"UNIQUE KEY `uk_{schema}_{table_name}_natural_key` ({','.join([f'`{key}`' for key in unique_keys])})" if unique_keys else ""
        else:
            table["unique_key"] = False

        if bool(foreign_keys):
            for fk in foreign_keys:
                # CONSTRAINT `fk_cm_storage_aggregate_node_id` FOREIGN KEY (`node_id`) REFERENCES `node` (`id`) ON DELETE CASCADE
                delete_action,update_action = find_fk_action(fk.get("constraint_actions", ""))
                table["foreign_keys"].append(f"CONSTRAINT `fk_{schema}_{table_name}_{fk['name']}` FOREIGN KEY (`{fk['name']}_id`) REFERENCES `{fk['foreign_key']}` (`id`) ON DELETE {delete_action} ON UPDATE {update_action}")

        foreign_keys_names = [fk["name"] for fk in foreign_keys]
        # index is foreign_keys_names, subtract unique_keys
        indexes = [k for k in foreign_keys_names if k not in unique_keys]
        
        table["indexes"] = [f"KEY `idx_{schema}_{table_name}_{index}` (`{index}_id`)" for index in indexes]
        # add KEY `fk_cm_storage_aggregate_node_id` (`node_id`),
        tables.append(table)



    table_definitions = jinja2.Environment(loader=jinja2.FileSystemLoader("my_library/templates")).get_template("schema.sql.j2")
    sql = table_definitions.render({"schema": schema, "tables": tables })
    return sql

# ==============================================================================
# DATABASE FUNCTIONS
# ==============================================================================
def get_unique_constraints(cursor_mysql, schema):
    sql = f"SELECT DISTINCT INDEX_NAME, TABLE_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = '{schema}' AND NON_UNIQUE = 0;"
    result = execute_sql(cursor_mysql, sql, fetchall=True)
    results = [{"INDEX_NAME": r[0], "TABLE_NAME": r[1]} for r in result]
    return results
def get_foreign_keys(cursor_mysql, schema):
    sql = f"SELECT kcu.CONSTRAINT_NAME, kcu.TABLE_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME, rc.DELETE_RULE FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc ON kcu.CONSTRAINT_NAME=rc.CONSTRAINT_NAME WHERE kcu.TABLE_SCHEMA = '{schema}' AND rc.CONSTRAINT_SCHEMA = '{schema}' AND REFERENCED_COLUMN_NAME IS NOT NULL;"
    result = execute_sql(cursor_mysql, sql, fetchall=True)
    results = [{
        "CONSTRAINT_NAME": r[0],
        "TABLE_NAME": r[1],
        "COLUMN_NAME": r[2],
        "REFERENCED_TABLE_NAME": r[3],
        "REFERENCED_COLUMN_NAME": r[4],
        "DELETE_RULE": r[5]
    } for r in result]
    return results
def drop_database(cursor_mysql, schema):
    sql = f"DROP DATABASE IF EXISTS {schema};"
    execute_sql(cursor_mysql, sql)
def create_database(cursor_mysql, schema):
    sql = f"CREATE DATABASE {schema};"
    execute_sql(cursor_mysql, sql)
def get_table_columns(cursor_mysql, schema, table):
    sql = f"SHOW COLUMNS FROM {schema}.{table};"
    result = execute_sql(cursor_mysql, sql, fetchall=True)
    columns = [column[0].lower() for column in result]
    return columns
def get_tables(cursor_mysql, schema):
    result = execute_sql(cursor_mysql, f"SHOW TABLES FROM {schema}", fetchall=True)
    tables = [table[0] for table in result]
    return tables
def recreate_database(cursor_mysql, schema):
    drop_database(cursor_mysql, schema)
    create_database(cursor_mysql, schema)
def get_tables_with_correct_keys(cursor_mysql, schema):
    sql = f"""
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '{schema}' AND COLUMN_KEY = 'PRI' AND COLUMN_NAME='id' AND DATA_TYPE='int' AND EXTRA LIKE '%auto_increment%';
    """
    result = execute_sql(cursor_mysql, sql, fetchall=True)
    tables_with_correct_keys = [r[0] for r in result]
    return tables_with_correct_keys
def collect_table_info(cursor_mysql, schema):
    log("Collecting table info")
    tables = get_tables(cursor_mysql, schema)
    foreign_keys = get_foreign_keys(cursor_mysql, schema)
    unique_constraints = get_unique_constraints(cursor_mysql, schema)
    primary_keys = get_tables_with_correct_keys(cursor_mysql, schema)

    table_info = {}
    for table in tables:
        table_info[table] = {}
        table_info[table]["unique_constraints"] = [uc for uc in unique_constraints if uc["TABLE_NAME"] == table]
        table_info[table]["foreign_keys"] = [fk for fk in foreign_keys if fk["TABLE_NAME"] == table]
        has_correct_key = table in primary_keys
        if not has_correct_key:
            warn(f"Table {table} does not have a correct primary key (id, int, auto_increment)")
        table_info[table]["has_correct_key"] = has_correct_key
        table_info[table]["columns"] = get_table_columns(cursor_mysql, schema, table)
    tables = [table for table in tables if table_info[table]["has_correct_key"]]

    for table in tables:
        min_id, max_id = get_min_max_id(cursor_mysql, schema, table)
        table_info[table]["min"] = min_id
        table_info[table]["max"] = max_id

    return tables, foreign_keys, unique_constraints, table_info
def get_count(cursor_mysql, schema, table):
    sql = f"SELECT COUNT(id) FROM {schema}.`{table}`;"
    result = execute_sql(cursor_mysql, sql, fetchone=True)
    return result[0]
def get_min_max_id(cursor_mysql, schema, table):
    sql = f"SELECT COALESCE(MIN(id), 0), COALESCE(MAX(id), 0) FROM {schema}.`{table}`;"
    result = execute_sql(cursor_mysql, sql, fetchone=True)
    return result[0], result[1]

# =============================================================================
# Import database functions
# =============================================================================
def recreate_dump_database(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    tables = datasource_config["tables"]
    log("Creating dump database")
    recreate_database(cursor_mysql, f"dump___{schema}")
    for table in tables:
        sql = f"CREATE TABLE dump___{schema}.{table} LIKE {schema}.{table};"
        execute_sql(cursor_mysql, sql)
def remove_unique_constraints_from_dump(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    unique_constraints = datasource_config["unique_constraints"]
    tables = datasource_config["tables"]
    log("Removing unique key constraints")
    for constraint in unique_constraints:
        table = constraint['TABLE_NAME']
        if table not in tables:
            continue
        index = constraint['INDEX_NAME']
        if(index=='PRIMARY'):
            sql = f"ALTER TABLE dump___{schema}.{table} CHANGE `id` `id` INT(11) NOT NULL, DROP PRIMARY KEY;"
        else:
            sql = f"ALTER TABLE dump___{schema}.{table} DROP INDEX {index};"
        execute_sql(cursor_mysql, sql)
def import_data_from_files(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    tables = datasource_config["tables"]
    csv_files = datasource_config["csv_files"]

    csv_import_path = datasource_config["csv_import_path"]
    log("Importing data from files")
    # dump data in tables
    for table in tables:
        filename = get_csv_path(csv_import_path, table)
        # check if the file exists and is not empty
        if filename not in csv_files:
            continue
        file_path = mysql_escape_string(filename)
        load_sql = (
            f"LOAD DATA LOCAL INFILE '{file_path}' "
            f"INTO TABLE dump___{schema}.{table} "
            f"FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '\"' "
            f"ESCAPED BY '\\\\' "
            f"LINES TERMINATED BY '\\n' "
            f"IGNORE 1 LINES;"
        )
        execute_sql(cursor_mysql, load_sql)
def delete_from_tables(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    datasource = datasource_config["datasource"]
    tables = datasource_config["tables"]
    datasourcer_schema = datasource_config["datasourcer_schema"]
    log("Removing from tables")
    for table in tables:
        delete_sql = (
            f"DELETE {schema}.{table} "
            f"FROM {schema}.{table} JOIN "
            f"(SELECT staging.* "
            f"FROM {datasourcer_schema}.staging JOIN "
            f"{datasourcer_schema}.datasource ON staging.datasource_id=datasource.id "
            f"AND datasource.name='{datasource}' "
            f"AND staging.table_name='{table}') s "
            f"ON {table}.id=s.table_id;"
        )
        execute_sql(cursor_mysql, delete_sql)
def delete_from_staging(cursor_mysql, datasource_config):
    datasource = datasource_config["datasource"]
    datasourcer_schema = datasource_config["datasourcer_schema"]
    log("Removing from staging")
    delete_sql = (
        f"DELETE {datasourcer_schema}.staging "
        f"FROM {datasourcer_schema}.staging JOIN "
        f"{datasourcer_schema}.datasource ON staging.datasource_id=datasource.id "
        f"AND datasource.name='{datasource}';"
    )
    execute_sql(cursor_mysql, delete_sql)
def validate_dump_data(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    foreign_keys = datasource_config["foreign_keys"]
    log("Cleaning up bad foreign keys")
    # remove records from dump tables where with missing foreign keys
    # or update the foreign key to null if cascade delete is not set
    for foreign_key in foreign_keys:
        table = foreign_key["TABLE_NAME"]
        referenced_table = foreign_key["REFERENCED_TABLE_NAME"]
        column = foreign_key["COLUMN_NAME"]
        referenced_column = foreign_key["REFERENCED_COLUMN_NAME"]
        cascade_delete = foreign_key["DELETE_RULE"]
        # delete records from dump table where foreign key is missing and cascade delete is set
        if cascade_delete == "CASCADE":
            sql = f"DELETE `x` FROM dump___{schema}.{table} `x` LEFT JOIN dump___{schema}.{referenced_table} `y` ON x.{column} = y.{referenced_column} WHERE y.{referenced_column} IS NULL;"
            execute_sql(cursor_mysql, sql)
        if cascade_delete == "SET NULL":
            sql = f"UPDATE dump___{schema}.{table} `x` LEFT JOIN dump___{schema}.{referenced_table} `y` ON x.{column} = y.{referenced_column} SET x.{column} = NULL WHERE y.{referenced_column} IS NULL;"
            execute_sql(cursor_mysql, sql)
def collect_auto_increments(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    tables = datasource_config["tables"]
    table_info = datasource_config["table_info"]
    log("Collecting auto increments")
    # get the count of records in the dump tables and register in table_info
    for table in tables:
        count = get_count(cursor_mysql, f"dump___{schema}", table)
        table_info[table]["dump_count"] = count
        # set the new auto increment value based on the count of records in the dump table and the min value
        # -----------------------------------------------
        # if the dump fits before the lowest id, insert the dump at the start
        # if not, add the dump after the highest id
        # doing this will keep clean id's non-stop increasing
        # here we search for the best place to insert the dump
        # -----------------------------------------------
        if count < (table_info[table]["min"]):
            # debug(f"Dump fits before the lowest id for table {table} - {count} < {table_info[table]['min']} -> 1")
            table_info[table]["new_auto_increment"] = 1
        else:
            # debug(f"Dump fits after the highest id for table {table} - {count} >= {table_info[table]['min']} -> {table_info[table]['max']} + 1")
            table_info[table]["new_auto_increment"] = table_info[table]["max"] + 1
def add_temp_auto_increment_to_dump(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    tables = datasource_config["tables"]
    table_info = datasource_config["table_info"]
    # -----------------------------------------------
    # the goal is create new clean id's
    # but still keep the references between tables
    # -----------------------------------------------
    debug("Adding temp auto increment")
    for table in tables:
        auto_increment_value = table_info[table]["new_auto_increment"]
        sql = f"ALTER TABLE dump___{schema}.{table} ADD COLUMN `new___id` INT(11) NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (`new___id`), AUTO_INCREMENT={auto_increment_value};"
        execute_sql(cursor_mysql, sql)
def correct_ids(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    tables = datasource_config["tables"]
    foreign_keys = datasource_config["foreign_keys"]
    log("Correcting id's")
    # -----------------------------------------------
    # after adding the new auto increment id's, we have clean new id's
    # the foreign keys need to be updated to these new id's
    # -----------------------------------------------
    for table in tables:
        # for every foreign key, update the foreign key to the new id of the referenced table
        for foreign_key in foreign_keys:
            if foreign_key["TABLE_NAME"] == table:
                referenced_table = foreign_key["REFERENCED_TABLE_NAME"]
                referenced_column = foreign_key["REFERENCED_COLUMN_NAME"]
                column = foreign_key["COLUMN_NAME"]
                # update the foreign key to the new id
                sql = f"UPDATE dump___{schema}.`{table}` `x` JOIN dump___{schema}.`{referenced_table}` `y` ON x.{column} = y.{referenced_column} SET x.{column} = y.new___id;"
                execute_sql(cursor_mysql, sql)

    # finally update all the primary keys
    for table in tables:
        # set id to new auto increment id
        sql = f"UPDATE dump___{schema}.`{table}` SET id=new___id;"
        execute_sql(cursor_mysql, sql)
def remove_temp_auto_increment_from_dump(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    tables = datasource_config["tables"]
    # -----------------------------------------------
    # after correcting the id's, we can remove the temp auto increment
    # and set the primary key back to id
    # -----------------------------------------------
    log("Removing temp id")
    for table in tables:
        # remove the new___id column
        # and set the primary index back to id
        sql = f"ALTER TABLE dump___{schema}.`{table}` DROP COLUMN new___id;"
        execute_sql(cursor_mysql, sql)
        sql = f"ALTER TABLE dump___{schema}.`{table}` ADD PRIMARY KEY (`id`);"
        execute_sql(cursor_mysql, sql)
def add_to_staging(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    tables = datasource_config["tables"]
    datasource_id = datasource_config["datasource_id"]
    datasourcer_schema = datasource_config["datasourcer_schema"]
    # -----------------------------------------------
    # add the data to the staging table
    # the staging tables is a table that keeps track of which record is for which datasource
    # this allows us to have multiple datasources in the same database
    # at each refresh, we need to know which old records are for which datasource to remove
    # here we add the new records to the staging table
    # ps : this table is huge, but it is only used for the delete queries
    # -----------------------------------------------
    log("Adding to staging")
    for table in tables:
        sql = f"INSERT IGNORE INTO {datasourcer_schema}.staging(datasource_id,table_id,table_name) SELECT {datasource_id},id,'{table}' FROM dump___{schema}.`{table}`;"
        execute_sql(cursor_mysql, sql)
def add_to_production(cursor_mysql, datasource_config):
    schema = datasource_config["schema"]
    tables = datasource_config["tables"]
    # -----------------------------------------------
    # add the data to the production tables
    # all id's have been corrected and all foreign keys have been updated
    # and all dumps with nicely fit either at the start or at the end of the current records
    # -----------------------------------------------
    log("Insert into production")
    for table in tables:
        sql = f"INSERT IGNORE INTO {schema}.`{table}` SELECT * FROM dump___{schema}.`{table}`;"
        execute_sql(cursor_mysql, sql)

# =============================================================================
# Import csv functions
# =============================================================================
def compare_headers_with_columns(headers, columns, table):
    missing_in_csv = [column for column in columns if column not in headers]
    missing_in_table = [header for header in headers if header not in columns]
    if len(missing_in_csv) > 0:
        # if only missing_in_csv = "id", accept it, we will add it with \N value using pandas reindex
        if len(missing_in_csv) == 1 and missing_in_csv[0] == "id":
            warn(f"Id column missing in csv for table {table} - fixing")
            return "ADD_ID"
        else:
            raise Exception(f"Columns missing in csv: {missing_in_csv}")
    if len(missing_in_table) > 0:
        warn(f"Extra column found in csv : {missing_in_table}")
    return "OK"
def correct_csv(path):
    # remove carriage return from csv files
    with open(path, 'r') as file:
        filedata = file.read()
    file.close()
    # correct line endings and \\N => \N (for NULL values)
    filedata = filedata.replace('"\\\\N"', r"\N")
    filedata = "\n".join(filedata.splitlines())

    # Write the file out again
    with open(path, 'w',newline="\n") as file:
        file.write(filedata)
    file.close()
def fix_csvs(datasource_config):
    debug("Fixing csv files")
    csv_import_path = datasource_config["csv_import_path"]
    table_info = datasource_config["table_info"]
    tables = datasource_config["tables"]
    foreign_keys = datasource_config["foreign_keys"]
    hash_ids = datasource_config["hash_ids"]
    csv_files = []
    for table in tables:
        table_foreign_keys = [fk["COLUMN_NAME"] for fk in foreign_keys if fk["TABLE_NAME"] == table]
        file_path = get_csv_path(csv_import_path, table)
        # check if the file exists
        if os.path.exists(file_path): 
            # check if the file is empty
            if os.path.getsize(file_path) == 0:
                os.remove(file_path)
                warn(f"Removing empty file {file_path}")
                continue

            # if the first line is empty or newline, remove it
            with open(file_path, 'r') as file:
                first_line = file.readline().strip(' \t\n\r')
                if first_line == "":
                    file.close()
                    os.remove(file_path)
                    warn(f"Removing empty header file {file_path}")
                    continue
            file.close()


            csv_files.append(file_path)
            # -----------------------------------
            # Start fix
            # -----------------------------------
            debug(f"Checking csv columns for table {table}")

            # get the columns for the table
            columns = table_info[table]["columns"]

            # read csv, set headers to lower case
            data = pd.read_csv(file_path, delimiter=",", quotechar='"', escapechar="\\")
            data.columns = data.columns.str.lower()
            headers = data.columns.tolist()

            # compare headers with columns
            if compare_headers_with_columns(headers, columns, table) == "ADD_ID":
                data["id"] = r"\N"
            elif hash_ids:
                # hash the id's
                data["id"] = data["id"].apply(lambda x: hash(x)%(10**9))
            
            # hash the foreign keys
            if hash_ids:
                for fk in table_foreign_keys:
                    data[fk] = data[fk].apply(lambda x: hash(x)%(10**9))

            # check if the arrays are equal (same order too)
            if columns != headers:
                # reorder the columns in the csv according to the table
                data = data.reindex(columns=columns)
                data.to_csv(file_path, index=False, sep=",", header=True, doublequote=True, escapechar="\\",quoting=csv.QUOTE_ALL,lineterminator="\n")
                warn(f"Reordered columns in csv for table {table}")
            elif hash_ids:
                data.to_csv(file_path, index=False, sep=",", header=True, doublequote=True, escapechar="\\",quoting=csv.QUOTE_ALL,lineterminator="\n")
                warn(f"Hashed id's in csv for table {table}")
            else:
                pass
                debug(f"Columns in csv are in correct order for table {table}")
            # correct the csv file
            correct_csv(file_path)
    # store the csv files that exists and not empty
    datasource_config["csv_files"] = csv_files

    # remove all extra csv files
    for file in os.listdir(csv_import_path):
        # get full path of file from file object
        filepath = os.path.join(csv_import_path, file)
        if file.endswith(".csv") and filepath not in csv_files:
            os.remove(filepath)
            warn(f"Removing unexpected file {file}")


# main code
def run_module():
    # define available arguments/parameters a user can pass to the module
    module_args = dict(
        # debug                     = dict(type='bool', required=False, default=False),
        datasource  = dict(type='dict', required=True), # datasource object
        mysql_conn  = dict(type='dict', required=True), # mysql connection details
        import_path = dict(type='str', required=True),  # import path
        force       = dict(type='bool', required=False, default=False), # force import
        keep        = dict(type='bool', required=False, default=False), # keep csv files
        hash_ids    = dict(type='bool', required=False, default=False) # hash id's
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
    force                              = module.params['force']
    keep                               = module.params['keep']
    hash_ids                           = module.params['hash_ids']



    MYSQL_HOST     = mysql.get("host")        # mysql host
    MYSQL_PORT     = int(mysql.get("port",3306))        # mysql port
    MYSQL_USER     = mysql.get("user")        # mysql user
    MYSQL_PASSWORD = mysql.get("password")    # mysql password
    MYSQL_DATABASE = "AnsibleForms"

    try:

        mysql_conn, cursor_mysql = open_database(MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD)
        # get the datasource config
        datasource_config = get_datasource_config(cursor_mysql, ds, MYSQL_DATABASE, import_path)
        datasource_config["hash_ids"] = hash_ids
        csv_import_path = datasource_config["csv_import_path"]    
        iso_time = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        marker_file = os.path.join(csv_import_path, f"{iso_time}.importing")
        # find the ready marker file
        # we only run the import if there is no .importing file
        # and there is a .ready file
        ready_files = [file for file in os.listdir(csv_import_path) if file.endswith(".ready")]
        csv_files = [file for file in os.listdir(csv_import_path) if file.endswith(".csv")]

        try:

            if len(csv_files) == 0:
                raise Exception("No csv files found to import")

            if len(ready_files) == 0 and not force:
                raise Exception("No .ready file found, datasource not ready to import")        

            # if already importing, raise an error
            # any file ending with .importing is considered as an import in progress
            # use the filename as the timestamp to show in the error message
            # find any file ending with .importing
            # get the file name
            # raise an error
            for file in os.listdir(csv_import_path):
                if file.endswith(".importing"):
                    timestamp = file.split(".")[0]
                    # parse the time from "%Y-%m-%d_%H-%M-%S"
                    time = datetime.datetime.strptime(timestamp, "%Y-%m-%d_%H-%M-%S")
                    human_time = time.strftime("%Y-%m-%d %H:%M:%S")
                    raise Exception(f"Import in progress: running since {human_time}")


            # create a marker file to indicate that the import is in progress, do avoid double imports
            iso_time = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            marker_file = os.path.join(csv_import_path, f"{iso_time}.importing")
            with open(marker_file, "w") as f:
                f.write("Import in progress")

            # remove the .ready files, at this point
            for file in ready_files:
                os.remove(os.path.join(csv_import_path, file))            

            schema = datasource_config["schema"]
            fix_csvs(datasource_config)                        # fix csv columns, a collect file info
            # start the actual import
            start_transaction(mysql_conn)                      # start transaction
            disable_foreign_key_checks(cursor_mysql)           # disable foreign key checks

            # first create the dump database & tables
            recreate_dump_database(cursor_mysql, datasource_config)               # recreate the dump database from production
            remove_unique_constraints_from_dump(cursor_mysql, datasource_config)  # remove unique constraints from dump
            set_global_local_infile(cursor_mysql)                                 # set global local infile // allow local infile
            set_allow_invalid_dates(cursor_mysql)                                 # set allow invalid dates, for dates like 0000-00-00
            import_data_from_files(cursor_mysql, datasource_config)               # import data from files // load data infile

            # first commit, dump tables are ready and filled
            commit(mysql_conn)

            # add temp auto increment, it will automatically set the new___id to the new auto increment value
            # the start value is set based on the count of records in the dump table
            # this is done to avoid create clean id's and avoid conflicts
            start_transaction(mysql_conn)                                       # start transaction
            collect_auto_increments(cursor_mysql, datasource_config)            # collect auto increments
            add_temp_auto_increment_to_dump(cursor_mysql, datasource_config)    # add temp auto increment   
            # this is more due to a bug for delete from left join, we set the dump database as the current database
            execute_sql(cursor_mysql, f"USE dump___{schema};")
            correct_ids(cursor_mysql, datasource_config)                     # correct the id's
            remove_temp_auto_increment_from_dump(cursor_mysql, datasource_config)    # remove the temp auto increment
            validate_dump_data(cursor_mysql, datasource_config)                      # validate the dump data
            delete_from_tables(cursor_mysql, datasource_config)                      # remove the records in the production
            delete_from_staging(cursor_mysql, datasource_config)                     # remove the records in the staging
            add_to_staging(cursor_mysql, datasource_config)                          # add the data to staging
            add_to_production(cursor_mysql, datasource_config)                       # add the data to production
            drop_database(cursor_mysql, f"dump___{schema}")                          # drop the dump database
            enable_foreign_key_checks(cursor_mysql)                                  # enable foreign key checks
            
            commit(mysql_conn)    # commit the transaction

            if not keep:
                # remove all csv files after the import
                csv_files = [file for file in os.listdir(csv_import_path) if file.endswith(".csv")]
                for file in csv_files:
                    os.remove(os.path.join(csv_import_path, file))

        except Exception as e:
            # Log the error and rollback changes in case of an error
            rollback(mysql_conn)

            # Log the error
            error("Error: " + str(e))
            # if(LOG_CONSOLE_LEVEL == "DEBUG"):
            #     traceback.print_exc()
            err = str(e)

            
        finally:


            # close databases
            close_database(mysql_conn)

            # remove the marker file if it exists
            if os.path.exists(marker_file):
                os.remove(marker_file)



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
