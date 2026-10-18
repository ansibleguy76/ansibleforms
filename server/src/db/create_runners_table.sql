USE `AnsibleForms`;
CREATE TABLE `runners` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(250) NOT NULL,
  `type` varchar(20) NOT NULL,
  `description` text DEFAULT NULL,
  `uri` varchar(500) NOT NULL,
  `token` text DEFAULT NULL,
  `username` varchar(250) DEFAULT NULL,
  `password` text DEFAULT NULL,
  `use_credentials` tinyint(4) DEFAULT 0,
  -- a credential of Connections > Credentials it signs in with ; its own token, user and password
  -- only while it has none
  `credential` varchar(250) DEFAULT NULL,
  `ignore_certs` tinyint(4) DEFAULT 0,
  `ca_bundle` text DEFAULT NULL,
  `is_default` tinyint(4) DEFAULT 0,
  `managed` tinyint(4) DEFAULT 0,
  `node_id` varchar(250) DEFAULT NULL,
  -- an RTE : database (deprecated), outbound (it dials the app) or inbound (the app dials it)
  `rte_mode` varchar(10) DEFAULT NULL,
  -- turned off, no job goes to it (it stays listed, its settings kept)
  `enabled` tinyint(4) DEFAULT 1,
  -- an RTE that asked to join and waits for an admin's approval : since when, and what it said
  -- of itself (host, address, mode, version, the fingerprint of its token)
  `pending` tinyint(4) DEFAULT 0,
  `pending_since` datetime DEFAULT NULL,
  `pending_info` text DEFAULT NULL,
  -- the SHA-256 of the ca_bundle its RTE's certificate was stored as (a runner without a
  -- credential) : cleared when an admin changes the bundle
  `rte_cert_sha256` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_AnsibleForms_runners_natural_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
