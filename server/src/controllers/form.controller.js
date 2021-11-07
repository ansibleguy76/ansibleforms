'use strict';
const logger=require("./../lib/logger")
const helpers=require("../lib/common")
const appConfig=require("../../config/app.config")
const Ajv = require('ajv');
const ajv = new Ajv()
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
exports.findAll = function(req,res){

  // implement this as you want, here we just return the json from the config directory
  // but you can return json from any source.
  try{
    helpers.nocache(appConfig.formsPath)
    var forms = require(appConfig.formsPath)
    var schema = require("./../../schema/forms_schema.json")
    logger.debug("validating forms json against schema")
    const valid = ajv.validate(schema, forms)
    if (!valid){
      logger.error(ajv.errors)
      res.json({error:`${JSON.stringify(ajv.errors)}`})
    }else{
      logger.debug("Valid forms.json")
      logger.debug("Sending forms config file to client")
      res.json(forms);
    }
  }catch(err){
    // if parsing error, return errormessage
    var errorMessage=err.toString()
    logger.error(err)
    res.json({error:errorMessage})
  }

}
