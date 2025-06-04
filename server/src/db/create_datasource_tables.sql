USE `AnsibleForms`;
CREATE TABLE `datasource_schemas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(250) NOT NULL,
  `description` varchar(250) DEFAULT '',
  `table_definitions` longtext DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `output` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_AnsibleForms_datasource_schemas_natural_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
CREATE TABLE `datasource` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `schema` VARCHAR(255) NOT NULL,
  `cron` VARCHAR(50) DEFAULT NULL,
  `form` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT NULL,
  `last_run` DATETIME DEFAULT NULL,
  `state` VARCHAR(50) DEFAULT NULL,
  `queue_id` INT DEFAULT 0,
  `extra_vars` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `output` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  UNIQUE KEY `uk_ds_natural_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
CREATE TABLE `staging` (
  `datasource_id` INT NOT NULL,
  `table_name` VARCHAR(255) NOT NULL,
  `table_id` VARCHAR(255) NOT NULL,
  UNIQUE KEY `uk_ds_staging_natural_key` (datasource_id, table_name, table_id),
  FOREIGN KEY (datasource_id) REFERENCES datasource(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;;
