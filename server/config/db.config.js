import logger from "../src/lib/logger.js";

if(!process.env["DB_HOST"]){
  logger.error("DB_HOST is missing")
}
if(!process.env["DB_PORT"]){
  logger.error("DB_PORT is missing")
}
if(!process.env["DB_USER"]){
  logger.error("DB_USER is missing")
}
if(!process.env["DB_PASSWORD"]){
  logger.error("DB_USER is missing")
}
if(!(process.env["DB_HOST"] && process.env["DB_PORT"] && process.env["DB_USER"] && process.env["DB_PASSWORD"])){
  logger.error("DB_PASSWORD = *******")
  throw new Error("You must set the database environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD)")
}
var db_config = {
  name: "ANSIBLEFORMS_DATABASE",
  host: process.env["DB_HOST"],
  user: process.env["DB_USER"],
  password: process.env["DB_PASSWORD"],
  port: process.env["DB_PORT"]
};
export default db_config;
