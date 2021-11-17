const resolve = require("path").resolve
var ansible_config = {
  path: process.env.ANSIBLE_PATH || (__dirname + '/../persistent/playbooks')
};

module.exports = ansible_config;
