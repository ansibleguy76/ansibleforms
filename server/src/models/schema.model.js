'use strict';
const bcrypt = require('bcrypt');
const logger=require("../lib/logger");
const dbConfig = require("../../config/db.config")
const mysql = require("../lib/mysql")
//user object create
var Schema=function(){
};

Schema.hasSchema = function (result) {
  mysql.query("ANSIBLEFORMS_DATABASE",`SHOW DATABASES LIKE 'AnsibleForms'`,null, function (err, res) {
    if(err) {
      result("Failed to query databases in AnsibleForms MySql. " + err, null);
    }
    else{
      if(res.length > 0){
        logger.debug(`Checking tables in schema 'AnsibleForms'`)
        mysql.query("ANSIBLEFORMS_DATABASE","SHOW TABLES FROM `AnsibleForms`;",null,function(err,res){
          if(err) {
              result("Failed to query tables in the AnsibleForms schema. " + err, null);
          }
          else{
              if(res.length == 8){
                result(null,{status:"success",message:`schema 'AnsibleForms' and tables are present`})
              }else{
                logger.warn(`Tables are not ok`)
                result(null,{status:"error",message:`schema 'AnsibleForms' is present, but some tables are not`});
              }
          }
        })
      }else{
        logger.warn(`Schema AnsibleForms' is not ok`)
        result(null,{status:"error",message:`schema 'AnsibleForms' is not present`});
      }
    }
  })
}
Schema.create = function (result) {
  logger.info(`Try to create database schema 'AnsibleForms' and tables`)
  var query="CREATE DATABASE /*!32312 IF NOT EXISTS*/`AnsibleForms` /*!40100 DEFAULT CHARACTER SET utf8 */;\
              USE `AnsibleForms`;\
              DROP TABLE IF EXISTS `groups`;\
              CREATE TABLE `groups`(\
                `id` int(11) NOT NULL AUTO_INCREMENT,\
                `name` varchar(255) NOT NULL,\
                  PRIMARY KEY (`id`),\
                  UNIQUE KEY `uk_AnsibleForms_groups_natural_key` (`name`)\
              ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;\
              DROP TABLE IF EXISTS `users`;\
              CREATE TABLE `users`(\
                `id` int(11) NOT NULL AUTO_INCREMENT,\
                `username` varchar(255) NOT NULL,\
                `password` varchar(255) NOT NULL,\
                `group_id` int(11) NOT NULL,\
                  PRIMARY KEY (`id`),\
                  UNIQUE KEY `uk_AnsibleForms_users_natural_key` (`username`),\
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
              DROP TABLE IF EXISTS `credentials`;\
              CREATE TABLE `credentials` (\
                `id` int(11) NOT NULL AUTO_INCREMENT,\
                `name` varchar(250) NOT NULL,\
                `user` varchar(250) NOT NULL,\
                `password` text NOT NULL,\
                `host` varchar(250) DEFAULT NULL,\
                `port` int(11) DEFAULT NULL,\
                `description` text NOT NULL,\
                PRIMARY KEY (`id`),\
                UNIQUE KEY `uk_AnsibleForms_credentials_natural_key` (`name`)\
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8;\
              DROP TABLE IF EXISTS `ldap`;\
              CREATE TABLE `ldap` (\
                `server` varchar(250) DEFAULT NULL,\
                `port` int(11) DEFAULT NULL,\
                `ignore_certs` tinyint(4) DEFAULT NULL,\
                `enable_tls` tinyint(4) DEFAULT NULL,\
                `cert` text DEFAULT NULL,\
                `ca_bundle` text DEFAULT NULL,\
                `bind_user_dn` varchar(250) DEFAULT NULL,\
                `bind_user_pw` text DEFAULT NULL,\
                `search_base` varchar(250) DEFAULT NULL,\
                `username_attribute` varchar(250) DEFAULT NULL,\
                `enable` tinyint(4) DEFAULT NULL\
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8;\
              DROP TABLE IF EXISTS `awx`;\
              CREATE TABLE `awx` (\
                `uri` varchar(250) NOT NULL,\
                `token` varchar(250) NOT NULL\
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8;\
              DROP TABLE IF EXISTS `job_output`;\
              DROP TABLE IF EXISTS `jobs`;\
              CREATE TABLE `jobs` (\
                `id` int(11) NOT NULL AUTO_INCREMENT,\
                `command` longtext DEFAULT NULL,\
                `status` varchar(20) DEFAULT NULL,\
                `start` datetime NOT NULL DEFAULT current_timestamp(),\
                `end` datetime DEFAULT NULL,\
                PRIMARY KEY (`id`)\
              ) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8;\
              CREATE TABLE `job_output` (\
                `id` int(11) NOT NULL AUTO_INCREMENT,\
                `output` longtext DEFAULT NULL,\
                `timestamp` datetime NOT NULL DEFAULT current_timestamp(),\
                `output_type` varchar(10) NOT NULL,\
                `job_id` int(11) NOT NULL,\
                `order` int(11) NOT NULL,\
                PRIMARY KEY (`id`),\
                KEY `FK_job_output_jobs` (`job_id`),\
                CONSTRAINT `FK_job_output_jobs` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\
              ) ENGINE=InnoDB AUTO_INCREMENT=1650 DEFAULT CHARSET=utf8;\
              INSERT INTO AnsibleForms.groups(name) VALUES('admins');\
              INSERT INTO AnsibleForms.awx(uri,token) VALUES('','');\
              INSERT INTO AnsibleForms.users(username,password,group_id) VALUES('admin','$2b$10$Z/W0HXNBk2aLR4yVLkq5L..C8tXg.G.o1vkFr8D2lw8JSgWRCNiCa',1);\
              INSERT INTO AnsibleForms.ldap(server,port,ignore_certs,enable_tls,cert,ca_bundle,bind_user_dn,bind_user_pw,search_base,username_attribute,enable) VALUES('',389,1,0,'','','','','','sAMAccountName',0);"

  mysql.query("ANSIBLEFORMS_DATABASE",query,null, function (err, res) {
    if(err) {
      result(err, null);
    }
    else{
      if(res.length > 0){
        logger.info(`Created schema 'AnsibleForms' and tables`)
        result(null,`Created schema 'AnsibleForms' and tables`)
      }else{
        result(`Failed to create schema 'AnsibleForms' and/or tables`,null)
      }
    }
  });
};


module.exports= Schema;
