USE `AnsibleForms`;
-- the API tokens issued (Profile > API token) : who has which, until when, last used ; revoking
-- one ends its session (sid) : models/apiToken.model.js
CREATE TABLE IF NOT EXISTS `api_tokens` (
  `sid` varchar(64) NOT NULL,
  `username` varchar(250) NOT NULL,
  `username_type` varchar(20) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `last_used_at` datetime DEFAULT NULL,
  PRIMARY KEY (`sid`),
  KEY `idx_api_tokens_user` (`username_type`, `username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
