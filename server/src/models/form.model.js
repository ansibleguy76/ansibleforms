'use strict';
const appConfig = require('./../../config/app.config');
const logger=require("../lib/logger")
const fs=require("fs")
const os=require("os")
const fse=require("fs-extra")
const YAML=require("yaml")
const Ajv = require('ajv');
const ajv = new Ajv()
const path=require("path")
const AJVErrorParser = require('ajv-error-parser');

function getFormsDir(){
  return path.join(path.dirname(appConfig.formsPath),"/forms");
}

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
  var formsdirpath=path.join(path.dirname(appConfig.formsPath),"/forms");
  var formfilesraw=[]
  var formfiles=[]
  var files=undefined
  try{
    // read base forms.yaml
    rawdata = fs.readFileSync(appConfig.formsPath,'utf8');
    // read extra form files
    try{
      files = fs.readdirSync(formsdirpath)
      if(files){
        // filter only yaml
        files=files.filter((item)=>['.yaml','.yml'].includes(path.extname(item)))
        // read files
        files.forEach((item, i) => {
          try{
            formfilesraw.push({name:item,value:fs.readFileSync(path.join(formsdirpath,item),'utf8')})
          }catch(e){
            logger.error(`failed to load file '${item}'.\n${e}`)
          }
        });
      }
    }catch(e){
      logger.warn("No forms directory... loading only forms.yaml")
    }

  }catch(e){
    logger.error("Error reading the forms.yaml file : " + e)
    throw `Error reading the forms.yaml file : ${e}`
  }
  // parse base yaml
  try{
    forms = YAML.parse(rawdata)
  }catch(e){
    logger.error("Error parsing the forms.yaml file : " + e)
    throw `Error parsing the forms.yaml file : ${e}`
  }
  // parse extra files
  formfilesraw.forEach((item,i)=>{
    try{
      formfiles.push({name:item.name,value:YAML.parse(item.value)})
    }catch(e){
      logger.error(`failed to parse file '${item.name}'.\n${e}`)
    }
  })
  if(!forms.forms){
    forms.forms=[]
  }
  // merge extra files
  formfiles.forEach((item, i) => {
      logger.debug(`merging file ${item.name}`)
      try{
          var existing = forms.forms.map(x => x.name);
          [].concat(item.value||[]).forEach((f, i) => {
            if(!existing.includes(f.name)){
              logger.silly(`adding form ${f.name}`)
              f.source=item.name
              forms.forms.push(f)
            }else{
              logger.warn(`skipping existing form ${f.name}`)
            }
          });
      }catch(e){
        logger.error(`failed to merge file '${item.name}' into forms.yaml.\n${e}`)
      }
  });

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
    logger.silly("validating forms.yaml against schema")
    const valid = ajv.validate(schema, forms)
    if (!valid){
      var ajvMessages = AJVErrorParser.parseErrors(ajv.errors)
      logger.error(ajvMessages)
      throw `${ajvMessages.join("\r\n")}`
    }else{
      logger.silly("Valid forms.yaml")
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
  logger.debug("Saving forms")
  var files={}

  // filter source-forms out of forms and move to files
  formsConfig.forms = formsConfig.forms.filter(item => {
    var src = item.source
    if(src){
      if(!files[src]){
        files[src]=[]
      }
      files[src].push(item)
      return false
    }else{
      return true
    }
  })

  let tmpDir;
  const appPrefix = 'ansibleforms';
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), appPrefix));
    var formsdir=getFormsDir()
    var backupformsdir=formsdir+".bak"
    for (const [file, forms] of Object.entries(files)) {
      var tmpfile=path.join(tmpDir,file)
      var formnames=forms.map(x => x.name)
      if(forms.length==1){
        logger.silly(`saving single form '${forms[0].name}' to '${tmpfile}'`)
        fs.writeFileSync(tmpfile,YAML.stringify(forms[0]));
      }
      if(forms.length>1){
        logger.silly(`saving forms ${formnames} to '${tmpfile}'`)
        fs.writeFileSync(tmpfile,YAML.stringify(forms));
      }
    }
    logger.silly(`Removing backup directory '${backupformsdir}'`)
    fse.removeSync(backupformsdir)
    logger.silly(`Moving forms directory '${formsdir}'->'${backupformsdir}'`)
    fse.moveSync(formsdir,backupformsdir)
    logger.silly(`Moving tmp directory '${tmpDir}'->'${formsdir}'`)
    fse.moveSync(tmpDir,formsdir)
    logger.silly(`Writing base file '${appConfig.formsPath}'`)
    fs.writeFileSync(appConfig.formsPath,YAML.stringify(formsConfig));
  }
  catch(e) {
    // handle error
    var msg=`Failed to save forms. ${e}`
    logger.error(msg)
    throw msg
  }
  finally {
    try {
      if (tmpDir) {
        logger.silly(`Cleaning up folder '${tmpDir}'`)
        //fs.rmSync(tmpDir, { recursive: true });
      }
    }
    catch (e) {
      console.error(`An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`);
    }
  }

  return true
}
module.exports= Form;
