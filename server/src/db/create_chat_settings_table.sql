USE `AnsibleForms`;
CREATE TABLE `chat_settings` (
  `provider` varchar(20) DEFAULT NULL,
  `api_key` text DEFAULT NULL,
  `base_url` varchar(500) DEFAULT NULL,
  `model` varchar(200) DEFAULT NULL,
  `max_turns` int(11) DEFAULT 20,
  `max_tool_rounds` int(11) DEFAULT 6,
  `timeout_seconds` int(11) DEFAULT 60,
  `allow_job_status` tinyint(4) DEFAULT 1,
  `auth_type` varchar(20) DEFAULT NULL,
  `api_version` varchar(50) DEFAULT NULL,
  `request_user` varchar(100) DEFAULT NULL,
  `extra_headers` text DEFAULT NULL,
  `ignore_certs` tinyint(4) DEFAULT 0,
  `managed` tinyint(4) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
