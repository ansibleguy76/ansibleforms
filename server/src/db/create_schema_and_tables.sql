SET FOREIGN_KEY_CHECKS=0;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`AnsibleForms` /*!40100 DEFAULT CHARACTER SET utf8 */;
USE `AnsibleForms`;
DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups`(
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_AnsibleForms_groups_natural_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`(
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `group_id` int(11) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_AnsibleForms_users_natural_key` (`username`),
    KEY `FK_users_group` (`group_id`),
    CONSTRAINT `FK_users_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
DROP TABLE IF EXISTS `tokens`;
CREATE TABLE `tokens` (
  `username` varchar(250) NOT NULL,
  `username_type` varchar(10) NOT NULL,
  `refresh_token` text DEFAULT NULL,
  `timestamp` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
DROP TABLE IF EXISTS `credentials`;
CREATE TABLE `credentials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(250) NOT NULL,
  `user` varchar(250) NOT NULL,
  `password` text NOT NULL,
  `host` varchar(250) DEFAULT NULL,
  `port` int(11) DEFAULT NULL,
  `description` text NOT NULL,
  `secure` tinyint(4) DEFAULT NULL,
  `db_type` varchar(10) DEFAULT NULL,
  `db_name` varchar(255) DEFAULT NULL,  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_AnsibleForms_credentials_natural_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
DROP TABLE IF EXISTS `ldap`;
CREATE TABLE `ldap` (
  `server` varchar(250) DEFAULT NULL,
  `port` int(11) DEFAULT NULL,
  `ignore_certs` tinyint(4) DEFAULT NULL,
  `enable_tls` tinyint(4) DEFAULT NULL,
  `cert` text DEFAULT NULL,
  `ca_bundle` text DEFAULT NULL,
  `bind_user_dn` varchar(250) DEFAULT NULL,
  `bind_user_pw` text DEFAULT NULL,
  `search_base` varchar(250) DEFAULT NULL,
  `username_attribute` varchar(250) DEFAULT NULL,
  `enable` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
DROP TABLE IF EXISTS `awx`;
CREATE TABLE `awx` (
  `uri` varchar(250) NOT NULL,
  `username` varchar(250) NOT NULL,
  `token` text NOT NULL,
  `password` text NOT NULL,
  `use_credentials` tinyint(4) DEFAULT NULL,
  `ignore_certs` tinyint(4) DEFAULT NULL,
  `ca_bundle` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
DROP TABLE IF EXISTS `job_output`;
DROP TABLE IF EXISTS `jobs`;
CREATE TABLE `jobs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form` varchar(250) DEFAULT NULL,
  `target` varchar(250) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `start` datetime NOT NULL DEFAULT current_timestamp(),
  `end` datetime DEFAULT NULL,
  `user` varchar(250) DEFAULT NULL,
  `user_type` varchar(10) DEFAULT NULL,
  `job_type` varchar(20) DEFAULT NULL,
  `extravars` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credentials` mediumtext DEFAULT NULL,
  `notifications` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approval` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `step` varchar(250) DEFAULT NULL,
  `parent_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8;
CREATE TABLE `job_output` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `output` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timestamp` datetime NOT NULL DEFAULT current_timestamp(),
  `output_type` varchar(10) NOT NULL,
  `job_id` int(11) NOT NULL,
  `order` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_job_output_jobs` (`job_id`),
  CONSTRAINT `FK_job_output_jobs` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1650 DEFAULT CHARSET=utf8;
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `mail_server` varchar(250) DEFAULT NULL,
  `mail_port` int(11) DEFAULT NULL,
  `mail_secure` tinyint(4) DEFAULT NULL,
  `mail_username` varchar(250) DEFAULT NULL,
  `mail_password` text DEFAULT NULL,
  `mail_from` varchar(250) DEFAULT NULL,
  `url` varchar(250) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
USE `AnsibleForms`;
DROP TABLE IF EXISTS `azuread`;
CREATE TABLE `azuread` (
  `client_id` text DEFAULT NULL,
  `secret_id` text DEFAULT NULL,
  `enable` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
INSERT INTO AnsibleForms.azuread(client_id,secret_id,enable) VALUES('','',0);
INSERT INTO AnsibleForms.groups(name) VALUES('admins');
INSERT INTO AnsibleForms.awx(uri,token,username,password) VALUES('','','','');
INSERT INTO AnsibleForms.users(username,password,group_id) VALUES('admin','$2b$10$Z/W0HXNBk2aLR4yVLkq5L..C8tXg.G.o1vkFr8D2lw8JSgWRCNiCa',1);
INSERT INTO AnsibleForms.ldap(server,port,ignore_certs,enable_tls,cert,ca_bundle,bind_user_dn,bind_user_pw,search_base,username_attribute,enable) VALUES('',389,1,0,'','','','','','sAMAccountName',0);
INSERT INTO AnsibleForms.settings(mail_server,mail_port,mail_secure,mail_username,mail_password,mail_from,url) VALUES('',25,0,'','','','');
SET FOREIGN_KEY_CHECKS=1;
