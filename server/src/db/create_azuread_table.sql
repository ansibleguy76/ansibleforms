USE `AnsibleForms`;
DROP TABLE IF EXISTS `azuread`;
CREATE TABLE `azuread` (
  `client_id` text DEFAULT NULL,
  `secret_id` text DEFAULT NULL,
  `enable` tinyint(4) DEFAULT NULL,
  `groupfilter` varchar(250) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

