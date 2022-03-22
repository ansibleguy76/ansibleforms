USE `AnsibleForms`;
CREATE TABLE `settings` (
  `mail_server` varchar(250) DEFAULT NULL,
  `mail_port` int(11) DEFAULT NULL,
  `mail_secure` tinyint(4) DEFAULT NULL,
  `mail_username` varchar(250) DEFAULT NULL,
  `mail_password` text DEFAULT NULL,
  `mail_from` varchar(250) DEFAULT NULL,
  `url` varchar(250) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
INSERT INTO AnsibleForms.settings(mail_server,mail_port,mail_secure,mail_username,mail_password,mail_from,url) VALUES('',25,0,'','','','');
