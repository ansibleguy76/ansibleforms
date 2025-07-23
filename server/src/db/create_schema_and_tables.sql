-- disable foreign key checks to avoid errors when creating tables
SET FOREIGN_KEY_CHECKS=0;
-- create the database if it does not exist
CREATE DATABASE /*!32312 IF NOT EXISTS*/`AnsibleForms` /*!40100 DEFAULT CHARACTER SET utf8 */;
-- use the database
USE `AnsibleForms`;
-- create groups table
DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups`(
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_AnsibleForms_groups_natural_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
-- create users table
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`(
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `group_id` int(11) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_AnsibleForms_users_natural_key` (`username`),
    KEY `FK_users_group` (`group_id`),
    CONSTRAINT `FK_users_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
-- create tokens table
DROP TABLE IF EXISTS `tokens`;
CREATE TABLE `tokens` (
  `username` varchar(250) NOT NULL,
  `username_type` varchar(10) NOT NULL,
  `refresh_token` text DEFAULT NULL,
  `timestamp` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
-- create credentials table
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
  `is_database` tinyint(4) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_AnsibleForms_credentials_natural_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
-- create ldap table
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
  `groups_search_base` varchar(250) DEFAULT NULL,
  `groups_attribute` varchar(250) DEFAULT NULL,
  `group_class` varchar(250) DEFAULT NULL,
  `group_member_attribute` varchar(250) DEFAULT NULL,
  `group_member_user_attribute` varchar(250) DEFAULT NULL,
  `is_advanced` tinyint(4) DEFAULT NULL,
  `mail_attribute` varchar(250) DEFAULT NULL,
  `enable` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
-- create awx table
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
-- create job_output and jobs tables
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
  `abort_requested` tinyint(4) DEFAULT NULL,
  `extravars` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credentials` mediumtext DEFAULT NULL,
  `notifications` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approval` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `step` varchar(250) DEFAULT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `awx_id` int(11) DEFAULT NULL,
  `awx_artifacts` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
-- create settings table
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `mail_server` varchar(250) DEFAULT NULL,
  `mail_port` int(11) DEFAULT NULL,
  `mail_secure` tinyint(4) DEFAULT NULL,
  `mail_username` varchar(250) DEFAULT NULL,
  `mail_password` text DEFAULT NULL,
  `mail_from` varchar(250) DEFAULT NULL,
  `url` varchar(250) DEFAULT NULL,
  `forms_yaml` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL 
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
-- create azuread table
DROP TABLE IF EXISTS `azuread`;
CREATE TABLE `azuread` (
  `client_id` text DEFAULT NULL,
  `secret_id` text DEFAULT NULL,
  `enable` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
-- create oidc table
DROP TABLE IF EXISTS `oidc`;
CREATE TABLE `oidc` (
  `issuer` text DEFAULT NULL,
  `client_id` text DEFAULT NULL,
  `secret_id` text DEFAULT NULL,
  `enabled` tinyint(4) DEFAULT NULL,
  `groupfilter` varchar(250) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
-- create repositories table
DROP TABLE IF EXISTS `repositories`;
CREATE TABLE `repositories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(250) NOT NULL,
  `user` varchar(250) DEFAULT NULL,
  `password` text DEFAULT NULL,
  `uri` varchar(250) DEFAULT NULL,
  `description` text NOT NULL,
  `use_for_forms` tinyint(4) DEFAULT NULL,
  `use_for_playbooks` tinyint(4) DEFAULT NULL,  
  `cron` varchar(50) DEFAULT NULL,  
  `status` varchar(50) DEFAULT NULL,
  `output` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `head` varchar(50) DEFAULT NULL,    
  `rebase_on_start` tinyint(4) DEFAULT NULL,  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_AnsibleForms_repositories_natural_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- default values are created at startup

-- enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;
