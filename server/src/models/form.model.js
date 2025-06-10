'use strict';
import appConfig from './../../config/app.config.js';
import logger from "../lib/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fse from "fs-extra";
import moment from "moment";
import { execSync } from 'child_process';
import yaml from "yaml";
import Ajv from 'ajv';
const ajv = new Ajv();
import AJVErrorParser from 'ajv-error-parser';
import quote from 'shell-quote/quote.js';
import Repository from './repository.model.js';
import Helpers from "../lib/common.js";
import Settings from './settings.model.js';
import os from 'os';

// Construct __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load JSON schemas synchronously
const baseSchema = JSON.parse(fs.readFileSync(path.join(__dirname, "../../schema/base_schema.json"), "utf8"));
const formSchema = JSON.parse(fs.readFileSync(path.join(__dirname, "../../schema/form_schema.json"), "utf8"));
const formsSchema = JSON.parse(fs.readFileSync(path.join(__dirname, "../../schema/forms_schema.json"), "utf8"));
const jsonSchemaDraft6 = JSON.parse(fs.readFileSync(path.join(__dirname, "../../node_modules/ajv/lib/refs/json-schema-draft-06.json"), "utf8"));

const backupPath = appConfig.formsBackupPath

const formFilePath = path.dirname(appConfig.formsPath)
const formFileName = path.basename(appConfig.formsPath)
const formsPath = path.join(formFilePath,"forms")
const formsBackupPath = path.join(backupPath,'forms')
const formFileBackupPath = path.join(backupPath,formFileName)
const oldBackupDays = appConfig.oldBackupDays

const pathDelimiterRegex = new RegExp(`(?<!\\\\)${path.delimiter}`, 'g');

function getBackupSuffix(t){
  var backuppartre=new RegExp("(\.bak\.[0-9]{17})$","g")
  var backuppart=backuppartre.exec(t)[1]
  return backuppart
}
ajv.addMetaSchema(jsonSchemaDraft6);
var Form=function(data){
  this.forms = data.forms;
};

/**
 * Compute ytt cli options for library data values based on provided env vars
 */
function getYttLibDataOpts() {
  var yttLibDataOpts = '';
  for (const [libName, value] of Object.entries(appConfig.yttLibData)) {
    yttLibDataOpts += ` --data-values-file @${quote([libName])}:data=${quote([value])}`;
  }
  return yttLibDataOpts;
}

/**
 * Compute extra ytt cli options based on provided env vars
 */
function getYttEnvDataOpts() {
  var yttEnvDataOpts = '';
  if (appConfig.yttVarsPrefix || false) {
    yttEnvDataOpts += ` --data-values-env ${quote([appConfig.yttVarsPrefix])}`;
  }
  if (appConfig.yttAllowSymlinkDestinations || false) {
    // path.delimiter separated list of paths (delimiter can be escaped with '\')
    for (const allowedPath of appConfig.yttAllowSymlinkDestinations.split(pathDelimiterRegex)) {
      yttEnvDataOpts += ` --allow-symlink-destination ${quote([allowedPath.replace(/\\(.)/g, '$1')])}`;
    }
  }
  if (appConfig.yttDangerousAllowAllSymlinkDestinations) {
    yttEnvDataOpts += " --dangerous-allow-all-symlink-destinations";
  }
  return yttEnvDataOpts;
}


function execYtt(file,libdir) {

  // database didn't deliver any forms, so let's load from file
  var libDataOpts = getYttLibDataOpts();
  var envDataOpts = getYttEnvDataOpts();  
  logger.info(`interpreting ${file} with ytt.`);
  logger.debug(`executing 'ytt -f ${quote([file])} -f ${quote([libdir])}${envDataOpts}${libDataOpts}'`);
  var data = execSync(
      `ytt -f ${quote([file])} -f ${quote([libdir])}${envDataOpts}${libDataOpts}`,
      {
        env: process.env,
        encoding: 'utf-8'
      } 
  );
  if (!data) {
    throw new Error(`ytt did not return any data for file ${file}`);
  }
  return data;
}

function copyFormsTemplate(to) {
  try{
    logger.warning("No forms found in database or forms.yaml... creating empty one from template")
    var formsTemplatePath = path.join(__dirname,"../../templates/forms.yaml.template")
    fs.copyFileSync(formsTemplatePath,to)
    logger.warning("File copied")
  } catch (e) {
    logger.error(`Failed to copy forms from template '${formsTemplatePath}'.`,e);
    throw new Error(Helpers.getError(e,"There is no forms.yaml nor could there be one created from template."))
  }
}

async function getBaseConfig(formsPath) {
  var rawdata=''

  // if we should find the forms in the database, let's do that
  if(appConfig.enableFormsYamlInDatabase){
    const settings = await Settings.findFormsYaml()    
    // if not empty
    if(settings.forms_yaml.trim()){
      logger.info(`Using forms yaml from database`)      
      rawdata = settings.forms_yaml // loading from db
    }else{
      logger.warning("No forms.yaml found in database, falling back to disk file")
    }
  }else{
    logger.info(`Loading ${formsPath}`)  
  }

  if(!rawdata){
    // at this point we have no forms yet... let's see if we have a forms.yaml file
    if (!fs.existsSync(formsPath)) {
      copyFormsTemplate(formsPath);
    }
    // at this point we have a forms.yaml file, even if it is empty from template

    if (appConfig.useYtt) {
      // try to process ytt
      try{
        const yttLibDir=path.join(path.dirname(formsPath),"/lib");
        rawdata = execYtt(formsPath,yttLibDir);
      } catch (e) {
        logger.error(`Failed to load '${formsPath}' with ytt.`,e);
        throw new Error(Helpers.getError(e,"Error processing the base forms.yaml file with ytt."))
      }
    } else {
      // try to read the file
      try{
        logger.info(`Using forms yaml from file`)      
        rawdata = fs.readFileSync(formsPath, 'utf8');
      } catch (e) {
        logger.error(`Failed to load '${formsPath}'.`,e);
        throw new Error(Helpers.getError(e,"Error reading the base forms.yaml file."))
      }
    }
  }

  // now let's see if it's valid yaml
  try{
    const forms = yaml.parse(rawdata)
    logger.debug("Base forms loaded and is valid YAML")
    return forms;
  }catch(err){
    logger.error("Error",err)
    throw new Error(Helpers.getError(err,"Error parsing the base forms, it's not valid yaml."))
  }  
}

function getFormInfo(form,formName='',loadFullConfig=false) {
  // if we are loading full config, return the full form object
  if(loadFullConfig){
     return Form.validateForm(form); // validate the form and return
  }
  if(!formName){
    // list, only mimimal info
    return {
      icon: form.icon || '',
      image: form.image || '',
      name: form.name,
      categories: form.categories || [],
      description: form.description || '',
      tileClass: form.tileClass || ''
    };
  }
  else if(form.name == formName) {
    // validate the form and return
    return Form.validateForm(form);
  }
  // no match
  return null;

}


function getFormsFromFile(formsPath,filename){
  var rawData = '';
  const formPath = path.join(formsPath, filename);
  if (appConfig.useYtt) {
    try{
      // process with ytt
      const yttLibDir=path.join(path.dirname(formsPath),"/lib");
      rawData = execYtt(formPath, yttLibDir);
    } catch (e) {
      throw new Error(`Failed to load '${formPath}' and process with ytt.`,e);

    }
  } else {
    try{
      // read the file
      rawData =fs.readFileSync(formPath,'utf8');
    } catch (e) {
      throw new Error(`Failed to load '${formPath}.`,e);
    }
  }

  logger.info(`merging file ${filename}`)
  try{
    const data = yaml.parse(rawData);
    var forms = [].concat(data || [])
    for(let form of forms){
      form.source = filename; // add source to the form
    }
    return forms;
  } catch (e) {
    throw new Error(`Failed to parse '${formPath}' as yaml.`,e);
  }  
}

function checkFormRole(form, userRoles) {
  if(!userRoles) {
    return true
  }
  if(userRoles.includes("admin")){
    return true
  }
  if(form.roles){
    for(var role of form.roles){
      if(userRoles.includes(role)){
        return true
      }
    }
  }
  return false
}

// load the forms config
Form.load = async function(userRoles,formName='',loadFullConfig=false,baseOnly=false) {
  logger.debug(`Loading forms with userRoles=${userRoles}, formName=${formName}, loadFullConfig=${loadFullConfig}, baseOnly=${baseOnly}`)
  var existingFormNames=[]
  var errors = []
  var warnings = []
  const formsPath = (await Repository.getFormsPath()) || appConfig.formsPath
  const formsdirpath=path.join(path.dirname(formsPath),"/forms");  

  function warn(message) {
    logger.warning(message);
    warnings.push(message);
  }
  function error(message) {
    logger.error(message);
    errors.push(message);
  }
  // let's load the base config
  var unvalidatedBase = await getBaseConfig(formsPath);
  // let's grab the base config and validate it, without it the app won't work
  var baseConfig = {
    categories: unvalidatedBase.categories || [],
    roles: unvalidatedBase.roles || [],
    constants: unvalidatedBase.constants || {}
  }
  // validate base config
  baseConfig = Form.validateConfig(baseConfig); // throws if not valid with the error messages
  logger.debug("Base config validated against schema")

  // just interested in the base config, no forms needed
  if(baseOnly){
    // if we only want the base config, return it now
    logger.debug("Returning base config only, no forms requested")
    return baseConfig;
  }

  baseConfig.forms = []; // initialize forms array  


  var unvalidatedForms = unvalidatedBase.forms || []; // get the forms from the base config, will be deprecated in the future
  if (unvalidatedForms.length > 0){
    warn("Found forms in base config, this will be deprecated in the future, please use forms directory instead.")
  }
  // set source to base (no source)
  for(let f of unvalidatedForms){
    delete f.source // remove source from the base forms, it is not needed
  };
  // read extra form files
  try{
    var files = fs.readdirSync(formsdirpath)
  } catch (e) {
    // if the forms directory does not exist, we can just return the base forms
    warn(`Failed to load forms directory '${formsdirpath}'.`,e);
  }
  if(!files){
    files = []
  }
  if(files){
    // filter only yaml
    files=files.filter((item)=>['.yaml','.yml'].includes(path.extname(item)))
    // read files
    for (const item of files) {
      // read the file and add to the forms array
      logger.debug(`Loading forms from file ${item}`)
      try{
        unvalidatedForms = unvalidatedForms.concat(getFormsFromFile(formsdirpath,item)); // get the forms from the file, if any and merge them into the unvalidatedForms array
      }
      catch (e) {
        error(e.message);
      }
    };
    for (const f of unvalidatedForms) {
      var form = null; // initialize form
      if(!f?.name){
        error(`Form found with no name.`)
        return // skip this form if no name is given
      }
      if(formName && f.name != formName){
        logger.debug(`Skipping form ${f.name}, not requested.`)
        continue // skip this form if it is not the one we are looking for
      }
      if(existingFormNames.includes(f.name)){
        warn(`skipping duplicate form ${f.name}`)
        continue
      }
      if(!checkFormRole(f,userRoles)){
        logger.debug(`User has no access to form ${f.name}.`)
        continue // skip this form if user has no access to it
      }
      existingFormNames.push(f.name) // collect all form names        
      logger.debug(`adding form ${f.name}`)
      try{
        form = getFormInfo(f,formName,loadFullConfig); // retreive only the necessary form info
      } catch (e) {
        error(`Failed to validate form '${f.name}'.`,e);
      }  
      if(form){
        baseConfig.forms.push(form);   // merge the form into the base forms
        // if we are loading full config, we can return the form right away
        if(formName){
          baseConfig.errors = errors; // add errors to the base config
          baseConfig.warnings = warnings; // add warnings to the base config
          return baseConfig // exit early if we found the form we are looking for
        }                
      }
    };    
  }

  baseConfig.errors = errors; // add errors to the base config
  baseConfig.warnings = warnings; // add warnings to the base config
  return baseConfig; // return the base config with the forms
};
// load the forms config
Form.backups = function() {
  logger.info(`Loading backups`)
  var files=undefined
  var backups=[]
  try{
    files = fs.readdirSync(backupPath)
    if(files){
      // filter only backups
      files=files.filter((item)=>item.match(/y[a]{0,1}ml\.bak\.[0-9]{17}$/g))
      // parse the backup data
      backups=files.map(file => {
        var item=file.substring(file.length-17)
        var dt=moment(item.slice(0,8)+"T"+item.slice(8,14)+","+item.slice(14))
        return {'file':file,'date':dt.format("YYYY-MM-DD kk:mm:ss")}
      }).sort((a, b) => a.date < b.date && 1 || -1);
    }
  }catch(e){
    logger.warning("Failed to load backups. "+e)
  }
  return backups
};
Form.validateConfig = function(obj){
  if(obj){
    logger.debug("validating base against schema")
    const valid = ajv.validate(baseSchema, obj)
    if (!valid){
      var ajvMessages = AJVErrorParser.parseErrors(ajv.errors)
      ajvMessages=ajvMessages.map(x => {
        try{
          var tmp=`${x}`
          var category
          var role
          category = Helpers.friendlyAJVError(tmp,"categories","Category",obj.categories)
          if(category.changed){
            return category.value
          }
          role = Helpers.friendlyAJVError(tmp,"roles","Role",obj.roles)
          if(role.changed){
            return role.value
          }        
        }catch(e){
          logger.error(e)
          return x
        }     
        return tmp
      })
      logger.error(ajvMessages)
      throw new Error(`${ajvMessages.join("\r\n")}`)
    }else{
      logger.debug("Valid base")
      return obj
    }
  }
}
Form.validateForm = function(obj){
  if(obj){
    var valid = false
    logger.debug("validating form against schema")
    try{
      valid = ajv.validate(formSchema, obj)
    } catch (e) {
      logger.error("Failed to validate form against schema",e)
      throw new Error(Helpers.getError(e,"Failed to validate form against schema"))
    }
    if (!valid){
      var ajvMessages = AJVErrorParser.parseErrors(ajv.errors)
      ajvMessages=ajvMessages.map(x => {
        try{
          var tmp=`${x}`
          var field
          var tableField
          field = Helpers.friendlyAJVError(tmp,"fields","Field",obj.fields)
          if(field.changed){
            tmp = field.value
            if(obj.fields[field.index].tableFields){
              tableField = Helpers.friendlyAJVError(tmp,"tableFields","TableField",obj.fields[field.index].tableFields)
              if(tableField.changed){
                return tableField.value
              }    
            }
          }
        }catch(e){
          logger.error(e)
          return x
        }     
        return tmp
      })
      logger.error(ajvMessages)
      throw new Error(`${ajvMessages.join("\r\n")}`)
    }else{
      logger.debug("Valid forms.yaml")
      return obj
    }
  }
}
Form.validate = function(forms){
  if(forms){
    logger.debug("validating forms.yaml against schema")
    const valid = ajv.validate(formsSchema, forms)
    if (!valid){
      var ajvMessages = AJVErrorParser.parseErrors(ajv.errors)
      ajvMessages=ajvMessages.map(x => {
        try{
          var tmp=`${x}`
          var form
          var field
          var tableField
          var category
          var role
          category = Helpers.friendlyAJVError(tmp,"categories","Category",forms.categories)
          if(category.changed){
            return category.value
          }
          role = Helpers.friendlyAJVError(tmp,"roles","Role",forms.roles)
          if(role.changed){
            return role.value
          }        
          form = Helpers.friendlyAJVError(tmp,"forms","Form",forms.forms)
          if(form.changed){
            tmp = form.value
            field = Helpers.friendlyAJVError(tmp,"fields","Field",forms.forms[form.index].fields)
            if(field.changed){
              tmp = field.value
              if(forms.forms[form.index].fields[field.index].tableFields){
                tableField = Helpers.friendlyAJVError(tmp,"tableFields","TableField",forms.forms[form.index].fields[field.index].tableFields)
                if(tableField.changed){
                  return tableField.value
                }    
              }
            }
          }   
        }catch(e){
          logger.error(e)
          return x
        }     

        return tmp

      })
      logger.error(ajvMessages)
      throw new Error(`${ajvMessages.join("\r\n")}`)
    }else{
      logger.debug("Valid forms.yaml")
      return forms
    }
  }
}
Form.parse = function(data){
  var formsConfig = undefined
  try{
    logger.info("Parsing yaml data")
    formsConfig = yaml.parse(data.forms,{prettyErrors:true})
  }catch(err){
    logger.error("Error : ", err)
    throw new Error(Helpers.getError(err,"Failed to parse yaml"))
  }
  return formsConfig
}
Form.removeOld=function(days=60){
  var items = fs.readdirSync(backupPath)
  if(items && items.length){
    // filter only backup yamls
    items=items.filter((item)=>item.match(/\.bak\.[0-9]{17}$/g))
    // read files
    items.forEach((item, i) => {
      var dt=item.substring(item.length-17) // get time part
      var iso=moment(dt.slice(0,8)) // get date part
      var old=moment().diff(moment(iso),"days") // how old ?
      if(old>days){ // date is older than x days ?
        logger.debug("Removing old backup item")
        fse.removeSync(path.join(backupPath,item)) // remove backup
      }else{
        //logger.debug(`Keeping ${file} [${old} days]`)
      }
    });
  }
}
Form.backup = function(){
  logger.info("Making backup of forms")
  var timestamp=moment().format("YYYYMMDDkkmmssSSS")
  var backupformsdir=formsBackupPath +".bak."+timestamp
  var backupformsfile=formFileBackupPath +".bak."+timestamp
  var backupfile=path.parse(backupformsfile).base
  Form.removeOld(oldBackupDays)
  logger.debug(`Copying forms file '${appConfig.formsPath}'->'${backupformsfile}'`)
  fse.copySync(appConfig.formsPath,backupformsfile)
  if(fs.existsSync(formsPath)){
    logger.debug(`Copying forms directory '${formsPath}'->'${backupformsdir}'`)
    fse.removeSync(backupformsdir) // just in case, remove it (unlikely hit)
    fse.ensureDirSync(backupformsdir) // make backupdir
    fse.copySync(formsPath,backupformsdir) // make backup
  }
  return backupfile
}
// remove unique backupname with forms folder
Form.remove = function(backupName){
  logger.debug(`Removing old file '${backupName}'`)
  var backupformsdir=formsBackupPath+getBackupSuffix(backupName)
  var backupformsfile=formFileBackupPath+getBackupSuffix(backupName)
  logger.debug(`Removing forms file '${backupformsfile}'`)
  fse.removeSync(backupformsfile)
  if(fs.existsSync(backupformsdir)){
    logger.debug(`Removing forms directory '${backupformsdir}'`)
    fse.removeSync(backupformsdir)
  }
}
Form.restoreBackup = function(backupName){
  var backupformsdir=formsBackupPath+getBackupSuffix(backupName)
  var backupformsfile=formFileBackupPath+getBackupSuffix(backupName)
  logger.debug(`Copying forms file '${backupformsfile}'->'${appConfig.formsPath}'`)
  fse.copySync(backupformsfile,appConfig.formsPath)
  if(fs.existsSync(backupformsdir)){
    logger.debug(`Copying forms directory '${backupformsdir}'->'${formsPath}'`)
    fse.removeSync(formsPath) // just in case, remove it (unlikely hit)
    fse.ensureDirSync(formsPath) // make backupdir
    fse.copySync(backupformsdir,formsPath) // make backup
  }
}
Form.save = function(data){
  var formsConfig = Form.parse(data)
  formsConfig = Form.validate(formsConfig)
  logger.info("Saving forms")
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

    for (const [file, forms] of Object.entries(files)) {
      var tmpfile=path.join(tmpDir,file)
      var formnames=forms.map(x => x.name)
      if(forms.length==1){
        logger.debug(`saving single form '${forms[0].name}' to '${tmpfile}'`)
        fs.writeFileSync(tmpfile,yaml.stringify(forms[0]));
      }
      if(forms.length>1){
        logger.debug(`saving forms ${formnames} to '${tmpfile}'`)
        fs.writeFileSync(tmpfile,yaml.stringify(forms));
      }
    }
    // backup current forms config
    var backupfile=Form.backup()
    logger.debug(`Succesfull backup to ${backupfile}`)

    // now move tmp to prod
    logger.debug(`Copy tmp directory '${tmpDir}'->'${formsPath}'`)
    fse.emptyDirSync(formsPath) // empty formsdir
    fse.copySync(tmpDir,formsPath) // copy from temp

    logger.debug(`Writing base file '${appConfig.formsPath}'`)
    fs.writeFileSync(appConfig.formsPath,yaml.stringify(formsConfig)); // write basefile
  }
  catch(err) {
    // handle error
    logger.error("Failed to save forms : ",err)
    throw new Error(Helpers.getError(err,"Failed to save forms"))
  }
  finally {
    try {
      if (tmpDir) {
        logger.debug(`Cleaning up folder '${tmpDir}'`)
        fs.rmSync(tmpDir, { recursive: true });
      }
    }
    catch (e) {
      console.error(`An error has occurred while removing the temp folder at ${tmpDir}. Please remove it manually. Error: ${e}`);
    }
  }

  return true
}
Form.restore = function(backupName,backupBeforeRestore){
  logger.info(`Restoring backup '${backupName}'`)
  var tmpbackup
  try {
    // first backup current
    tmpbackup=Form.backup()
    Form.restoreBackup(backupName)
    if(!backupBeforeRestore)
      Form.remove(tmpbackup)
    return true
  }catch(e){
    logger.error("Failed to restore '${backupName}'." + e)
    if(tmpbackup){
      try{
        Form.restoreBackup(tmpbackup)
      }catch(err){
        logger.error(`Failed to undo failed restore '${tmpbackup}' !!`)
      }
    }
    return false
  }
}
// Form.loadByName = async function(form,user,forApproval=false){
//   var forms = await Form.load()
//   var formObj = forms?.forms.filter(x => x.name==form)
//   if(formObj.length>0){
//     if(forApproval){
//       return formObj[0]
//     }
//     logger.debug(`Form ${form} is found, checking access...`)
//     var access = formObj[0].roles.filter(role => user?.roles?.includes(role))
//     if(access.length>0 || user?.roles?.includes("admin")){
//       return formObj[0]
//       //logger.debug(`Form ${form}, access allowed...`)
//     }else {
//       logger.warning(`Form ${form}, no access...`)
//       return null
//     }
//   }else{
//     return null
//   }

// }
// create the backup path and 
// since version 4.0.3 the backups go under folder => move backups there (should be only once)
Form.initBackupFolder=function(){
  logger.info("Moving older form backups to new backup folder")
  try{
    fs.mkdirSync(backupPath, { recursive: true })
    // move old forms.bak.files
    var files = fs.readdirSync(formFilePath)
    if(files){
      // filter only backup-files and folders
      files=files.filter((item)=>item.match(/\.bak\.[0-9]*$/))
      // read files
      for(const item of files){
        try{
          const from = path.join(formFilePath,item)
          const to = path.join(backupPath,item)
          logger.debug(`moving ${from} -> ${to}`)
          fse.moveSync(from,to)
        }catch(e){
          logger.error(`failed to move item '${item}'.\n`,e)
        }
      };
    }
  }catch(e){
    logger.error("Failed to init backup folder\n",e)
  }  
  Form.removeOld(oldBackupDays)
}
export default  Form;