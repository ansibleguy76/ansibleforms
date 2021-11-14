const resolve = require("path").resolve
var ansible_config = {
  path: process.env.ANSIBLE_PATH || resolve('../server/persistent/playbooks')
};

module.exports = ansible_config;
