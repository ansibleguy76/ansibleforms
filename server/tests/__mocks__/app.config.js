export default {
  repoPath: '/tmp/test-repos',
  gitCloneCommand: 'git clone',
  gitPullCommand: 'git pull',
  gitPushCommand: 'git push',
  filterJobOutputRegex: '.*',
  awxApiPrefix: '/api/v2',
  // the designer switched on, as a default install (SHOW_DESIGNER unset)
  showDesigner: true,
  // the keys Helpers.logSafe masks, as the real config's default
  maskExtravarsRegex: 'password|secret|token',
};
export const DEFAULT_ADMIN_PASSWORD = "AnsibleForms!123";
