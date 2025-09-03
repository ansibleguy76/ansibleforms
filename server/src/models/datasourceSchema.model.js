'use strict';
import yaml from 'yaml';
import logger from "../lib/logger.js";
import mysql from './db.model.js';
import fs from "fs";

// DsSchema
// - name
// - description
// - table_definitions

// Goals is to manage the AnsibleForms.`schema` table
// as well as check if an actual schema exists in the mysql database

//user object create
class DsSchema {
  constructor(dsschema) {
    if (dsschema.name != undefined) {
      this.name = DsSchema.sanitizeName(dsschema.name);
    }
    if (dsschema.description != undefined) {
      this.description = dsschema.description;
    }
    if (dsschema.table_definitions != undefined) {
      this.table_definitions = dsschema.table_definitions;
    }
    // force
    this.force = dsschema.force || false;
  }
  static sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  }
  static async exists(name) {
    logger.info(`Checking if a mysql schema ${name} exists`);
    const result = await mysql.do("SELECT * FROM information_schema.schemata WHERE schema_name = ?;", name);
    return result.length > 0;
  }
  static async drop(name) {
    logger.info(`Dropping schema ${name}`);
    return await mysql.do("DROP SCHEMA IF EXISTS ??;", name);
  }
  static async create(record) {
    logger.info(`Creating schema ${record.name}`);
    const exists = await DsSchema.exists(record.name);
    if (exists && !record.force) {
      throw `Schema ${record.name} already exists in the database`;
    }
    if (exists && record.force) {
      await DsSchema.drop(record.name);
    }
    delete record.force;
    const result = await mysql.do("INSERT INTO AnsibleForms.`datasource_schemas` set ?", record);
    return result.insertId;
  }
  static async update(record, id) {
    delete record.force;
    logger.info(`Updating schema ${(record.name) ? record.name : id}`);
    return await mysql.do("UPDATE AnsibleForms.`datasource_schemas` set ? WHERE id=?", [record, id]);
  }
  static async delete(id) {
    const schema = await DsSchema.findById(id);
    // remove schema path recursively
    logger.info(`Removing schema path ${schema.path}`);
    try {
      fs.rmSync(schema.path, { recursive: true });
    } catch (e) { }

    logger.info(`Deleting schema ${id}`);
    return await mysql.do("DELETE FROM AnsibleForms.`datasource_schemas` WHERE id = ?", [id]);
  }
  static async findAll() {
    logger.info("Finding all schemas");
    return await mysql.do("SELECT * FROM AnsibleForms.`datasource_schemas`;");
  }
  static async findById(id) {
    logger.info(`Finding schema ${id}`);
    const result = await mysql.do("SELECT * FROM AnsibleForms.`datasource_schemas` WHERE id=?;", id);
    return result;
  }
  static async findByName(name) {
    logger.info(`Finding schema ${name}`);
    return await mysql.do("SELECT * FROM AnsibleForms.`datasource_schemas` WHERE name=?;", name);
  }
  static findFkAction(fk) {
    const FK_ACTIONS = {
      "cascade": "CASCADE",
      "set_null": "SET NULL",
      "restrict": "RESTRICT",
      "no_action": "NO ACTION"
    };

    const delete_match = fk.match(/delete_([a-z_]+)/);
    const update_match = fk.match(/update_([a-z_]+)/);
    let delete_action = "NO ACTION";
    let update_action = "NO ACTION";
    if (delete_match) {
      delete_action = FK_ACTIONS[delete_match[1]];
    }
    if (update_match) {
      update_action = FK_ACTIONS[update_match[1]];
    }
    return [delete_action, update_action];
  }
  static async reset(id) {
    var status, output;
    var schema = (await DsSchema.findById(id))[0];
    logger.info(`Resetting schema ${schema.name}`);

    // parse table_definitions from yaml
    const table_definitions = yaml.parse(schema.table_definitions);
    const tables = [];

    for (const table_name in table_definitions) {
      const table = {};
      const unique_keys = table_definitions[table_name].filter(column => column.unique).map(column => column.name);
      const foreign_keys = table_definitions[table_name].filter(column => column.foreign_key);
      const foreign_keys_names = foreign_keys.map(fk => fk.name);
      table.name = table_name;
      table.unique_key = false;
      table.foreign_keys = [];
      table.indexes = [];
      table.columns = [];

      for (const column of table_definitions[table_name]) {
        let c = "";
        let col_name = column.name || column;
        let col_type = (column.type || "varchar").toLowerCase();
        let col_length = column.length || (col_type === "varchar" ? 255 : null);
        let col_default = column.default || null;
        let col_nullable = column.nullable !== undefined ? column.nullable : true;
        let col_case_sensitive = column.case_sensitive || false;

        if (foreign_keys_names.includes(col_name)) {
          col_name = `${col_name}_id`;
          col_type = "int";
          col_length = null;
        }

        if (col_type === "string") {
          col_type = "varchar";
        }

        if (col_type === "bool") {
          col_default = col_default ? 1 : 0;
        }

        const col_type_length = col_length ? `${col_type}(${col_length})`.toUpperCase() : col_type.toUpperCase();
        c = `\`${col_name}\` ${col_type_length}`;

        if (col_case_sensitive) {
          c = `${c} CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`;
        }

        if (col_default) {
          if (["date", "datetime", "timestamp"].includes(col_type) && col_default.toLowerCase() === "current_timestamp") {
            c = `${c} DEFAULT CURRENT_TIMESTAMP`;
          } else if (["int", "bigint", "tinyint", "smallint", "mediumint", "decimal", "float", "double"].includes(col_type)) {
            c = `${c} DEFAULT ${col_default}`;
          } else {
            c = `${c} DEFAULT '${col_default}'`;
          }
        } else if (!col_nullable) {
          c = `${c} NOT NULL`;
        } else {
          c = `${c} DEFAULT NULL`;
        }

        if (column.comment) {
          c = `${c} COMMENT '${column.comment}'`;
        }

        table.columns.push(c);
      }

      if (unique_keys.length) {
        table.unique_key = `UNIQUE KEY \`uk_${schema.name}_${table_name}_natural_key\` (${unique_keys.map(key => `\`${key}\``).join(",")})`;
      }

      if (foreign_keys.length) {
        for (const fk of foreign_keys) {
          const [delete_action, update_action] = DsSchema.findFkAction(fk.constraint_actions || "");
          table.foreign_keys.push(`CONSTRAINT \`fk_${schema.name}_${table_name}_${fk.name}\` FOREIGN KEY (\`${fk.name}_id\`) REFERENCES \`${fk.foreign_key}\` (\`id\`) ON DELETE ${delete_action} ON UPDATE ${update_action}`);
        }
      }

      const indexes = foreign_keys_names.filter(name => !unique_keys.includes(name));
      table.indexes = indexes.map(index => `KEY \`idx_${schema.name}_${table_name}_${index}\` (\`${index}_id\`)`);

      tables.push(table);
    }

    let sql = `
  SET NAMES utf8;
  SET SQL_MODE='';
  SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
  SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
  SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
  SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0;

  CREATE DATABASE IF NOT EXISTS \`${schema.name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

  USE \`${schema.name}\`;
  `;

    tables.forEach(table => {
      sql += `
  /* Create table \`${table.name}\` */
  DROP TABLE IF EXISTS \`${table.name}\`;

  CREATE TABLE \`${table.name}\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    ${table.columns.join(',\n  ')},
    ${table.unique_key ? `${table.unique_key},` : ''}
    ${table.foreign_keys.join(',\n  ')}${table.foreign_keys.length ? ',' : ''}
    ${table.indexes.join(',\n  ')}${table.indexes.length ? ',' : ''}
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
    });

    sql += `
  SET SQL_MODE=@OLD_SQL_MODE;
  SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
  SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
  SET SQL_NOTES=@OLD_SQL_NOTES;
  `;

    let delete_sql = `DELETE AnsibleForms.staging FROM AnsibleForms.staging JOIN AnsibleForms.datasource ON staging.datasource_id=datasource.id WHERE datasource.schema='${schema.name}';`;

    try {
      await mysql.do("update AnsibleForms.`datasource_schemas` set output = ?,status = ? where id = ?", ["", "running", id]);
      await mysql.do(delete_sql);
      await mysql.do(sql);
      output = sql;
      status = "success";
    } catch (e) {
      output = e.message;
      status = "failed";
    }
    await mysql.do("update AnsibleForms.`datasource_schemas` set output = ?,status = ? where id = ?", [output, status, id]);
  }
}




export default  DsSchema;
