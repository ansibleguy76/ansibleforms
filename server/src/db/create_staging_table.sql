USE `AnsibleForms`;
CREATE TABLE `staging` (
  `datasource_id` INT NOT NULL,
  `table_name` VARCHAR(255) NOT NULL,
  `table_id` VARCHAR(255) NOT NULL,
  UNIQUE KEY `uk_ds_staging_natural_key` (datasource_id, table_name, table_id),
  FOREIGN KEY (datasource_id) REFERENCES datasource(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
