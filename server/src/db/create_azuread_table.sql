USE `AnsibleForms`;
DROP TABLE IF EXISTS `azuread`;
CREATE TABLE `azuread` (
  `client_id` text DEFAULT NULL,
  `secret_id` text DEFAULT NULL,
  `enable` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
INSERT INTO AnsibleForms.azuread(client_id,secret_id,enable) VALUES('','',0);
