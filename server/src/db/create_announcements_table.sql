-- the announcements under the header (Settings > Appearance > Announcements) : each with its
-- type and the moments it starts and ends showing (models/announcement.model.js)
USE `AnsibleForms`;
CREATE TABLE IF NOT EXISTS `announcements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message` varchar(500) NOT NULL,
  `level` varchar(10) NOT NULL DEFAULT 'info',
  `start_at` datetime DEFAULT NULL,
  `end_at` datetime DEFAULT NULL,
  `created_by` varchar(250) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
