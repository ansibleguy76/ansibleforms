var db_config = {
  name: "ANSIBLEFORMS_DATABASE",
  host: process.env["DB_HOST"] || "localhost",
  user: process.env["DB_USER"] || "root",
  password: process.env["DB_PASSWORD"] || "AnsibleForms",
  multipleStatements: true,
  connectionLimit: 100
};
module.exports = db_config;
