export default {
  notice: () => {},
  info: () => {},
  warning: () => {},
  error: () => {},
  debug: () => {},
  crit: () => {},
};

// the syslog servers' side of lib/logger.js : nothing is sent in a test
export const sendAuditLine = () => {};
export const applySyslogServers = () => ({ log: 0, audit: 0, failed: [] });
export const sendTestLine = async () => {};
