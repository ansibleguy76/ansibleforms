'use strict';
const appConfig = require('./../../config/app.config');
const logger=require("../lib/logger")
const fs=require("fs")
const YAML=require("yaml")
const Ajv = require('ajv');
const ajv = new Ajv()
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
//awx object create - not used but as instance for later
var Form=function(){

};

// run a playbook
Form.load = function() {

  logger.debug(`Loading ${appConfig.formsPath}`)
  var forms=undefined
  try{
    try{
      let rawdata = fs.readFileSync(appConfig.formsPath,'utf8');
      forms = YAML.parse(rawdata)
    }catch(e){
      logger.error("Error reading the forms.yaml file : " + e)
      Throw(`Error reading the forms.yaml file : ${e}`)
    }
    if(forms){
      var schema = require("../../schema/forms_schema.json")
      logger.debug("validating forms.yaml against schema")
      const valid = ajv.validate(schema, forms)
      if (!valid){
        logger.error(ajv.errors)
        Throw(`${JSON.stringify(ajv.errors)}`)
      }else{
        logger.debug("Valid forms.yaml")
        return forms
      }
    }
  }catch(err){
    logger.error(err.toString())
    Throw(err.toString())
  }


};
module.exports= Form;
