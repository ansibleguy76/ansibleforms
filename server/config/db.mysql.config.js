//- MYSQL Module
const logger = require('../src/lib/logger');
try{
    var mysql = require('mysql');
}catch(err){
    logger.warn("Cannot find `mysql` module. Is it installed ? Try `npm install mysql` or `npm install`.");
}

var mySqlConnections={}

function reconnect(CONN_NAME){
    var db_config = {
      host: process.env["DB_"+CONN_NAME+"_HOST"],
      user: process.env["DB_"+CONN_NAME+"_USER"],
      password: process.env["DB_"+CONN_NAME+"_PASSWORD"],
      multipleStatements: true
    };

    var db_conn_name = process.env["DB_"+CONN_NAME+"_NAME"]
    logger.debug("["+CONN_NAME+"] New connection tentative with " + db_conn_name + "...");

    //- Create a new one
    mySqlConnections[CONN_NAME] = mysql.createPool(db_config);

    //- Try to reconnect
    mySqlConnections[CONN_NAME].getConnection(function(err){
        if(err) {
            //- Try to connect every 2 seconds.
            setTimeout(function(){reconnect(CONN_NAME)}, 2000);
        }else {
            logger.info("["+CONN_NAME+"] New connection established with " + db_conn_name + ".")
            return mySqlConnections[CONN_NAME];
        }
    });
}


//-
//- Export
//-
// use this library
module.exports = function(CONN_NAME){

  // create a new mySqlConnections[CONN_NAME] pool
  var db_config = {
    host: process.env["DB_"+CONN_NAME+"_HOST"],
    user: process.env["DB_"+CONN_NAME+"_USER"],
    password: process.env["DB_"+CONN_NAME+"_PASSWORD"],
    multipleStatements: true
  };

  var db_conn_name = process.env["DB_"+CONN_NAME+"_NAME"]

  // initialize connection only once
  if(!mySqlConnections[CONN_NAME]){
    mySqlConnections[CONN_NAME] = mysql.createPool(db_config);
    mySqlConnections[CONN_NAME].getConnection(function(err){
        if(err) {
            logger.error("["+CONN_NAME+"] Cannot establish a connection with " + db_conn_name + ".");
            mySqlConnections[CONN_NAME] = reconnect(CONN_NAME);
        }else {
            logger.info("["+CONN_NAME+"] New connection established with " + db_conn_name + ".")
        }
    });
    // add error event to auto reconnect
    return mySqlConnections[CONN_NAME].on('error', function(err) {
        // monitor disconnections and reconnect
        logger.error("/!\\ ["+CONN_NAME+"] Cannot establish a connection with " + db_conn_name + ". /!\\ ("+err.code+")");
        return reconnect(CONN_NAME);
    });
  }else{
    return mySqlConnections[CONN_NAME]
  }

};
