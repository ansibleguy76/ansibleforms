'use strict';
const logger = require("../lib/logger");
const mysql = require("./db.model");
const version = require('../../package.json').version

const CheckModel = {
    async checkDatabaseConnection() {
        try {
            // Try to connect to the MySQL server
            await mysql.do('SELECT 1 AS result');
            return 'OK'; // Return 'OK' if the connection is successful
        } catch (error) {
            logger.error('Database connection: Failed');
            return 'Failed'; // Return 'Failed' if the connection fails
        }
    },

    async checkDatabaseExists(databaseName) {
        try {
            // Check if the database exists
            const query = `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`;
            const vars = [databaseName];
            const result = await mysql.do(query, vars);

            return result.length === 1 ? 'OK' : 'Failed'; // Return 'OK' if the database exists, 'Failed' otherwise
        } catch (error) {
            logger.error('Database check failed:', error);
            return 'Failed'; // Return 'Failed' if the check fails
        }
    },

    async checkTablesExist(databaseName,tableNames) {
        try {
            // Check if the provided tables exist
            const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`;
            const vars = [databaseName]
            const results = await mysql.do(query, vars);
            const existingTables = results.map(row => row.TABLE_NAME);
            const tableStatus = {};
            for (const tableName of tableNames) {
                tableStatus[tableName] = existingTables.includes(tableName) ? 'OK' : 'Failed';
            }

            return tableStatus;
        } catch (error) {
            logger.error('Table check failed:', error);
            return 'Failed'; // Return 'Failed' if the check fails
        }
    },

    async checkRecordExists(databaseName, tableName, record) {
        try {

            // Check if the record exists
            var query = `SELECT COUNT(*) as count FROM ${databaseName}.${tableName}`
            var vars=[]
            if(record){
                const column = Object.keys(record)[0]; // Assuming you pass only one column-value pair
                const value = record[column];
                query = `SELECT COUNT(*) as count FROM ${databaseName}.${tableName} WHERE ${column} = ?`;
                vars = [value];
            }
            const result = await mysql.do(query, vars);
            const recordCount = result[0].count;
            return recordCount > 0 ? 'OK' : 'Failed';
        } catch (error) {
            logger.error('Record check failed:', error);
            return 'Failed'; // Return 'Failed' if the check fails
        }
    },

    async getDatabaseVersion(databaseName) {
        try {

            // Check if the record exists
            var query = `SELECT database_version FROM ${databaseName}.settings`
            const result = await mysql.do(query);
            return result[0].database_version;
        } catch (error) {
            logger.error('Version check failed:', error);
            return 'Failed'; // Return 'Failed' if the check fails
        }
    },    
    

    async performChecks() {

        const requiredTables = ['groups','users','tokens','credentials','ldap','awx','job_output','jobs','settings','azuread'];
        const requiredRecords = [
            {label:'Group admins',tableName:'groups',query:{'name':'admins'}},
            {label:'User admin',tableName:'users',query:{'username':'admin'}},
            {label:'Awx settings',tableName:'awx',query:undefined},
            {label:'Ldap settings',tableName:'ldap',query:undefined},
            {label:'Mail settings',tableName:'settings',query:undefined}
        ];
        const databaseName = 'AnsibleForms';

        // set everything to skipped
        var summary = {
            databaseConnection: {
                status : 'Skipped',
                label : 'Mysql connection'
            }, 
            databaseExists: {
                status : 'Skipped',
                label : 'Database check' 
            }
        };
        // every table skipped
        for (const tableName of requiredTables) {
            summary[tableName] = {
                status : 'Skipped',
                label : `Table check ${tableName}`
            };
        }
        // every record skipped
        for (const record of requiredRecords) {
            summary[record.label] = {
                status : 'Skipped',
                label : record.label
            };
        }        
        summary["Application version"] = {
            status : 'OK',
            label : `Application version = ${version}`
        };


        try {
            summary.databaseConnection.status = await this.checkDatabaseConnection();

            if (summary.databaseConnection.status === 'OK') {
                summary.databaseExists.status = await this.checkDatabaseExists(databaseName);
                if (summary.databaseExists.status === 'OK') {

                    const tablesExistResults = await this.checkTablesExist(databaseName,requiredTables);

                    for (const [tableName, status] of Object.entries(tablesExistResults)) {
                        summary[tableName].status = status;
                    }
                    for (const record of requiredRecords){
                        if(summary[record.tableName].status == 'OK'){
                            summary[record.label].status = await this.checkRecordExists(databaseName,record.tableName,record.query)
                        }
                    }            
                }
            }
        } catch (error) {
            // Handle any errors here if necessary
            logger.error('Error performing checks:', error);
        }

        return summary;
    },

};

module.exports = CheckModel;
