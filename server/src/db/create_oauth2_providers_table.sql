USE `AnsibleForms`;
CREATE TABLE `oauth2_providers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `provider` VARCHAR(50) NOT NULL, -- e.g., 'azuread', 'oidc', 'google', 'github'
  `name` VARCHAR(100) DEFAULT NULL, -- required name for the provider
  `description` VARCHAR(250) DEFAULT NULL, -- optional description for the provider
  `issuer` TEXT DEFAULT NULL,
  `tenant_id` TEXT DEFAULT NULL,
  `client_id` TEXT DEFAULT NULL,
  `client_secret` TEXT DEFAULT NULL,
  `enable` TINYINT(4) DEFAULT NULL,
  `groupfilter` VARCHAR(250) DEFAULT NULL,
  `redirect_uri` TEXT DEFAULT NULL,
  `scope` TEXT DEFAULT NULL,
  `auth_url` TEXT DEFAULT NULL,
  `token_url` TEXT DEFAULT NULL,
  `userinfo_url` TEXT DEFAULT NULL,
  `extra` JSON DEFAULT NULL, -- for any additional provider-specific config
  UNIQUE KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;