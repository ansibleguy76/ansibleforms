USE `AnsibleForms`;
CREATE TABLE `settings` (
  `mail_server` varchar(250) DEFAULT NULL,
  `mail_port` int(11) DEFAULT NULL,
  `mail_secure` tinyint(4) DEFAULT NULL,
  `mail_username` varchar(250) DEFAULT NULL,
  `mail_password` text DEFAULT NULL,
  `mail_from` varchar(250) DEFAULT NULL,
  `url` varchar(250) DEFAULT NULL,
  `forms_yaml` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo` longtext DEFAULT NULL,
  `config_source` varchar(20) DEFAULT NULL,
  `default_language` varchar(5) DEFAULT NULL,
  `default_theme` varchar(10) DEFAULT NULL,
  `default_theme_color` varchar(7) DEFAULT NULL,
  `managed` tinyint(4) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

