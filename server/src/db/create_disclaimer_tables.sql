-- the disclaimer users accept once (Settings > Access > Disclaimer, models/disclaimer.model.js) :
-- each version of its text, kept as it was agreed to, and who accepted which version, when
USE `AnsibleForms`;
CREATE TABLE IF NOT EXISTS `disclaimer_versions` (
  `version` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `text` mediumtext NOT NULL,
  `checkbox_label` varchar(200) NOT NULL,
  `created_by` varchar(250) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS `disclaimer_acceptances` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(250) NOT NULL,
  `user_type` varchar(20) NOT NULL,
  `version` int(11) NOT NULL,
  `accepted_at` datetime NOT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  -- asked again by an admin : no longer counts, the user accepts again (a new row) ; kept as it was
  `asked_again_at` datetime DEFAULT NULL,
  `asked_again_by` varchar(250) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_disclaimer_acceptances_user_version` (`username`, `user_type`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
