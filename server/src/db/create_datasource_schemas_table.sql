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
