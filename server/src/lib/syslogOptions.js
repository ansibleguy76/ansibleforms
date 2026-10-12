// What a syslog server of Connections > Syslog may be set to : the protocols, levels and types
// winston-syslog takes, and what the server gets. The model checks a save against them, the
// logger builds its transports with them.
export const SYSLOG_PROTOCOLS = ['udp4', 'udp6', 'tcp4', 'tcp6', 'tls4', 'tls6', 'unix', 'unix-connect'];
export const SYSLOG_LEVELS = ['emerg', 'alert', 'crit', 'error', 'warning', 'notice', 'info', 'debug'];
export const SYSLOG_TYPES = ['BSD', '5424'];
// the server log (log), the audit entries (audit), or both
export const SYSLOG_RECEIVES = ['log', 'audit', 'both'];
