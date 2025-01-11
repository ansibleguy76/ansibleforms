USE `AnsibleForms`;
DROP TABLE IF EXISTS `oidc`;
CREATE TABLE `oidc` (
  `issuer` text DEFAULT NULL,
  `client_id` text DEFAULT NULL,
  `secret_id` text DEFAULT NULL,
  `enabled` tinyint(4) DEFAULT NULL,
  `groupfilter` varchar(250) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
