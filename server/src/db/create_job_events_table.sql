USE `AnsibleForms`;
CREATE TABLE `job_events` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `job_id` int(11) NOT NULL,
  -- its place among the job's events, from 1 (the af_events callback plugin's order)
  `order` int(11) NOT NULL,
  -- play, task, ok, changed, failed, skipped, unreachable, ignored or stats
  `type` varchar(20) NOT NULL,
  `play` varchar(500) DEFAULT NULL,
  `task` varchar(500) DEFAULT NULL,
  `host` varchar(250) DEFAULT NULL,
  -- seconds the host took on the task (a host result)
  `duration` decimal(10,3) DEFAULT NULL,
  -- when it happened, as the playbook saw it (unix seconds)
  `time` decimal(14,3) DEFAULT NULL,
  -- the result's message and fields, or the recap's counts : JSON, masked as the output
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  -- a host's or a loop item's whole result, as its details show it (a click on its output line) :
  -- JSON, masked as the output ; read one at a time, never with the list
  `result` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_job_events_order` (`job_id`, `order`),
  CONSTRAINT `FK_job_events_jobs` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
