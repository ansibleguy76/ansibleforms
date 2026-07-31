USE `AnsibleForms`;
CREATE TABLE `audit` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `actor` VARCHAR(255) DEFAULT NULL,
  `actor_type` VARCHAR(20) DEFAULT NULL,
  `ip` VARCHAR(45) DEFAULT NULL,
  `action` VARCHAR(64) NOT NULL,
  `target_type` VARCHAR(64) DEFAULT NULL,
  `target` VARCHAR(255) DEFAULT NULL,
  `outcome` VARCHAR(16) NOT NULL,
  `detail` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  KEY `idx_audit_created` (`created_at`),
  KEY `idx_audit_actor` (`actor`, `created_at`),
  KEY `idx_audit_action` (`action`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
