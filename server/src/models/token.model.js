'use strict';
import mysql from "./db.model.js";
import logger from "../lib/logger.js";

var Token = function(){};

Token.store = function (username, username_type, refresh_token) {
  var record = {};
  record.username = username;
  record.username_type = username_type;
  record.refresh_token = refresh_token;
  logger.info(`Adding token for ${record.username} (${record.username_type})`);
  return mysql.do("INSERT INTO AnsibleForms.`tokens` set ?", record);
};

Token.delete = function (username, username_type, refresh_token) {
  logger.info(`Deleting token for user ${username} (${username_type}) - ${refresh_token}`);
  Token.cleanup();
  return mysql.do("DELETE FROM AnsibleForms.`tokens` WHERE username=? AND username_type=? AND refresh_token=?", [username, username_type, refresh_token]);
};

Token.cleanup = function () {
  logger.info(`Deleting tokens older than a month`);
  mysql
    .do("DELETE FROM AnsibleForms.`tokens` WHERE timestamp < NOW() - INTERVAL 30 DAY")
    .then(() => {
      logger.notice("Cleanup tokens finished");
    })
    .catch((err) => {
      logger.error("Cleanup tokens failed. " + err);
    });
};

Token.check = function (username, username_type, refresh_token) {
  logger.info(`Checking token for user ${username} (${username_type})`);
  return mysql.do("SELECT refresh_token FROM AnsibleForms.`tokens` WHERE username=? AND username_type=? AND refresh_token=? LIMIT 1", [username, username_type, refresh_token]).then((res) => {
    if (res.length > 0) {
      return "Refresh token is OK";
    } else {
      throw `User ${username} (${username_type}) not found`;
    }
  });
};

export default Token;
