'use strict';
const appConfig = require('./../../config/app.config');
const logger=require("../lib/logger")
const fs=require("fs")
const YAML=require("yaml")
const Ajv = require('ajv');
const ajv = new Ajv()
const AJVErrorParser = require('ajv-error-parser');

ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
//awx object create - not used but as instance for later
var Form=function(data){
  this.forms = data.forms;
};

// run a playbook
Form.load = function() {

  logger.debug(`Loading ${appConfig.formsPath}`)
  var forms=undefined
  var rawdata=undefined
  try{
    rawdata = fs.readFileSync(appConfig.formsPath,'utf8');
  }catch(e){
    logger.error("Error reading the forms.yaml file : " + e)
    throw `Error reading the forms.yaml file : ${e}`
  }
  try{
    forms = YAML.parse(rawdata)
  }catch(e){
    logger.error("Error parsing the forms.yaml file : " + e)
    throw `Error parsing the forms.yaml file : ${e}`
  }
  try{
    return Form.validate(forms)
  }catch(err){
    logger.error(err)
    throw err
  }


};
Form.validate = function(forms){
  if(forms){
    var schema = require("../../schema/forms_schema.json")
    logger.debug("validating forms.yaml against schema")
    const valid = ajv.validate(schema, forms)
    if (!valid){
      var ajvMessages = AJVErrorParser.parseErrors(ajv.errors)
      logger.error(ajvMessages)
      throw `${ajvMessages.join("\r\n")}`
    }else{
      logger.debug("Valid forms.yaml")
      return forms
    }
  }
}
Form.parse = function(data){
  var formsConfig = undefined
  try{
    logger.debug("Parsing yaml data")
    formsConfig = YAML.parse(data.forms,{prettyErrors:true})
  }catch(err){
    logger.error(err.toString())
    throw ("failed to parse yaml : " + err.toString())
  }
  return formsConfig
}
Form.save = function(data){
  var formsConfig = Form.parse(data)
  formsConfig = Form.validate(formsConfig)
  logger.debug("Saving forms.yaml")
  fs.writeFileSync(appConfig.formsPath,YAML.stringify(formsConfig));
  return true
}
module.exports= Form;
