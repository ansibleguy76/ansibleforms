USE `AnsibleForms`;
CREATE TABLE `runner_leases` (
  -- the runner whose socket is held (its name under Connections > Runners)
  `runner` varchar(250) NOT NULL,
  -- the app node holding it (lib/role.js nodeId) : only that node sends the runner its jobs
  `node_id` varchar(250) NOT NULL,
  -- renewed while the node holds the socket ; past it another node may take it over
  `expires_at` datetime NOT NULL,
  -- outbound (the RTE dialed in) or inbound (this node dialed the RTE)
  `direction` varchar(10) NOT NULL,
  PRIMARY KEY (`runner`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
