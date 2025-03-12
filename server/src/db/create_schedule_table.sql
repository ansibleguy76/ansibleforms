USE `AnsibleForms`;
CREATE TABLE `schedule` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `cron` VARCHAR(50) DEFAULT NULL,
  `form` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(50) DEFAULT NULL,
  `last_run` DATETIME DEFAULT NULL,
  `state` VARCHAR(50) DEFAULT NULL,
  `queue_id` INT DEFAULT 0,  
  `extra_vars` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `output` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  UNIQUE KEY `uk_schedule_natural_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
