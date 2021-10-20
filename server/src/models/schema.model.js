'use strict';
const bcrypt = require('bcrypt');
const logger=require("../lib/logger");

//user object create
var Schema=function(){
};

Schema.hasSchema = function (config,result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    logger.debug(`Checking schema for authentication`)
    var query = `SHOW DATABASES LIKE 'authentication'`
    try{
      dbConn.query(query, function (err, res) {
          if(err) {
              logger.error(err)
              // no connection
              result("Failed to connect to the authentication database", null);
          }
          else{
              if(res.length > 0){
                logger.debug(`Checking table 'users','groups' and 'tokens' in schema 'authentication'`)
                var query = "SHOW TABLES FROM `authentication`;"
                dbConn.query(query, function (err, res) {
                    if(err) {
                        logger.error(err)
                        // no connection, unlikely error
                        result("Failed to query the authentication schema", null);
                    }
                    else{
                        if(res.length == 3){
                          result(null,{status:"success",message:`schema 'authentication' and tables are present`})
                        }else{
                          logger.warn(`Tables 'users', 'groups' or 'tokens' are not ok`)
                          result(null,{status:"error",message:`schema 'authentication' is present, but some tables are not`});
                        }
                    }
                });
              }else{
                logger.warn(`Schema authentication' is not ok`)
                result(null,{status:"error",message:`schema 'authentication' is not present`});
              }

          }
      });
    }catch(err){
      result("Cannot connect to authentication database", null);
    }
};
Schema.create = function (config,result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    try{
        logger.info(`Try to create database schema 'authentication' and table 'users'`)
        var query="CREATE DATABASE /*!32312 IF NOT EXISTS*/`authentication` /*!40100 DEFAULT CHARACTER SET utf8 */;\
                    USE `authentication`;\
                    DROP TABLE IF EXISTS `groups`;\
                    CREATE TABLE `groups`(\
                      `id` int(11) NOT NULL AUTO_INCREMENT,\
                      `name` varchar(255) NOT NULL,\
                        PRIMARY KEY (`id`),\
                        UNIQUE KEY `uk_authentication_groups_natural_key` (`name`)\
                    ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;\
                    DROP TABLE IF EXISTS `users`;\
                    CREATE TABLE `users`(\
                      `id` int(11) NOT NULL AUTO_INCREMENT,\
                      `username` varchar(255) NOT NULL,\
                      `password` varchar(255) NOT NULL,\
                      `group_id` int(11) NOT NULL,\
                        PRIMARY KEY (`id`),\
                        UNIQUE KEY `uk_authentication_users_natural_key` (`username`),\
                        KEY `FK_users_group` (`group_id`),\
                        CONSTRAINT `FK_users_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\
                    ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;\
                    DROP TABLE IF EXISTS `tokens`;\
                    CREATE TABLE `tokens` (\
                      `username` varchar(250) NOT NULL,\
                      `username_type` varchar(5) NOT NULL,\
                      `refresh_token` text DEFAULT NULL,\
                      PRIMARY KEY (`username`,`username_type`)\
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;\
                    INSERT INTO authentication.groups(name) VALUES('admins');\
                    INSERT INTO authentication.users(username,password,group_id) VALUES('admin','$2b$10$Z/W0HXNBk2aLR4yVLkq5L..C8tXg.G.o1vkFr8D2lw8JSgWRCNiCa',1)"

        dbConn.query(query, function (err, res) {
            logger.info(JSON.stringify(res))
            if(err) {
                logger.error(err)
                // no connection, unlikely error
                result(err, null);
            }
            else{

                if(res.length > 0){
                  logger.info(`Created schema 'authentication' and table 'users','groups','tokens'`)
                  result(null,`Created schema 'authentication' and table 'users','groups','tokens'`)
                }else{
                  result(`Failed to create schema 'authentication' and/or table 'users','groups','tokens'`,null)
                }

            }
        });

    }catch(err){
      logger.info(err)
      result("Cannot connect to authentication database", null);
    }
};


module.exports= Schema;
