// create a new dbConn pool
var awx_config = {
  uri: process.env.AWX_HOST,
  token: process.env.AWX_TOKEN
};

module.exports = awx_config;
