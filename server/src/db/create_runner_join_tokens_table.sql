USE `AnsibleForms`;
CREATE TABLE `runner_join_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  -- what it is for, as the admin named it (dmz-runners)
  `name` varchar(100) NOT NULL,
  -- the token's SHA-256 : the token itself is shown once, when it is made
  `token_hash` char(64) NOT NULL,
  -- the first characters, so a list can tell the tokens apart
  `prefix` varchar(16) NOT NULL,
  `created_by` varchar(250) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  -- after this it adds no runner any more ; NULL : never
  `expires_at` datetime DEFAULT NULL,
  -- how many runners may join with it ; NULL : any number
  `max_uses` int(11) DEFAULT NULL,
  `uses` int(11) NOT NULL DEFAULT 0,
  `last_used_at` datetime DEFAULT NULL,
  -- revoked by an admin : refused from then on
  `revoked` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_runner_join_tokens_hash` (`token_hash`),
  UNIQUE KEY `uk_runner_join_tokens_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
