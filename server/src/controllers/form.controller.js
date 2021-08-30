'use strict';
const logger=require("./../lib/logger")
const helpers=require("../lib/common.js")
exports.findAll = function(req,res){

  // implement this as you want, here we just return the json from the config directory
  // but you can return json from any source.
  try{
    helpers.nocache(process.env.FORMS_PATH)
    var forms = require(process.env.FORMS_PATH)
    logger.debug("Sending forms config file to client")
    res.json(forms);
  }catch(err){
    // if parsing error, return errormessage
    var errorMessage=err.toString()
    logger.error(err)
    res.json({error:errorMessage})
  }

}
