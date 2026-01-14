'use strict';
import appConfig from './../../config/app.config.js';
import logger from "../lib/logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fse from "fs-extra";
import moment from "moment";
import Errors from '../lib/errors.js';
import { execSync } from 'child_process';
import yaml from "yaml";
import Ajv from 'ajv';
import quote from 'shell-quote/quote.js';
import Repository from './repository.model.js';
import Helpers from "../lib/common.js";
import Settings from './settings.model.js';
import os from 'os';
import AJVErrorParser from './ajvErrorParser.model.js';
import _ from 'lodash';

const ajv = new Ajv({allErrors: true});

// Construct __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load JSON schemas synchronously
const baseSchema = JSON.parse(fs.readFileSync(path.join(__dirname, "../../schema/base_schema.json"), "utf8"));
const formSchema = JSON.parse(fs.readFileSync(path.join(__dirname, "../../schema/form_schema.json"), "utf8"));
const formsSchema = JSON.parse(fs.readFileSync(path.join(__dirname, "../../schema/forms_schema.json"), "utf8"));
const jsonSchemaDraft6 = JSON.parse(fs.readFileSync(path.join(__dirname, "../../node_modules/ajv/lib/refs/json-schema-draft-06.json"), "utf8"));

const backupPath = appConfig.formsBackupPath

// New paths using config.yaml
const configFilePath = path.dirname(appConfig.configPath)
const configFileName = path.basename(appConfig.configPath)
const formsPath = appConfig.formsFolderPath
const formsBackupPath = path.join(backupPath,'forms')
const configFileBackupPath = path.join(backupPath,configFileName)

// Legacy paths for backward compatibility
const legacyFormFilePath = path.dirname(appConfig.formsPath)
const legacyFormFileName = path.basename(appConfig.formsPath)
const legacyFormFileBackupPath = path.join(backupPath,legacyFormFileName)

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

/**
 * Get the config file path with fallback to legacy forms.yaml
 * Returns object with: { path, isLegacy, deprecationMessage }
 */
async function getConfigPath() {
  // Check for repository override first (already handles config.yaml → forms.yaml fallback)
  const repoConfigPath = await Repository.getConfigPath();
  if (repoConfigPath && fs.existsSync(repoConfigPath)) {
    const isLegacy = repoConfigPath.endsWith('forms.yaml');
    const deprecationMessage = isLegacy ? "Using forms.yaml is DEPRECATED. Please migrate to config.yaml (categories, roles, constants only). Forms should be in the forms/ folder." : null;
    if (isLegacy) {
      logger.warning(deprecationMessage);
    }
    logger.info(`Using config from repository: ${repoConfigPath}`);
    return { path: repoConfigPath, isLegacy, deprecationMessage };
  }
  
  // Check for config.yaml (new way)
  if (fs.existsSync(appConfig.configPath)) {
    logger.info(`Using config file: ${appConfig.configPath}`);
    return { path: appConfig.configPath, isLegacy: false, deprecationMessage: null };
  }
  
  // Fallback to forms.yaml (legacy)
  if (fs.existsSync(appConfig.formsPath)) {
    const deprecationMessage = "Using forms.yaml is DEPRECATED. Please migrate to config.yaml (categories, roles, constants only). Forms should be in the forms/ folder.";
    logger.warning(deprecationMessage);
    return { path: appConfig.formsPath, isLegacy: true, deprecationMessage };
  }
  
  // Neither exists, will need to create from template
  return { path: appConfig.configPath, isLegacy: false, deprecationMessage: null };
}

function copyConfigTemplate(to) {
  try{
    logger.warning("No config found in database or config.yaml... creating empty one from template")
    var configTemplatePath = path.join(__dirname,"../../templates/config.yaml.template")
    
    // Try new template first, fallback to legacy forms.yaml.template
    if (fs.existsSync(configTemplatePath)) {
      fs.copyFileSync(configTemplatePath, to)
    } else {
      logger.warning("config.yaml.template not found, using legacy forms.yaml.template")
      var formsTemplatePath = path.join(__dirname,"../../templates/forms.yaml.template")
      fs.copyFileSync(formsTemplatePath, to)
    }
    logger.warning("Config file copied from template")
  } catch (e) {
    logger.error(`Failed to copy config from template.`,e);
    throw new Error(Helpers.getError(e,"There is no config.yaml nor could one be created from template."))
  }
}

function copyFormsDirectoryTemplate(toDir) {
  try {
    const formsDirTemplatePath = path.join(__dirname, "../../templates/forms.template");
    logger.warning("No forms directory found... creating empty one from template");
    fse.copySync(formsDirTemplatePath, toDir, { overwrite: false, errorOnExist: false });
    logger.warning("Directory copied");
  } catch (e) {
    logger.error(`Failed to copy forms directory from template '${formsDirTemplatePath}'.`, e);
    throw new Error(Helpers.getError(e, "There is no forms directory nor could there be one created from template."));
  }
}

async function getBaseConfig() {
  var rawdata=''
  var deprecationMessage = null;

  // if we should find the config in the database, let's do that
  if(appConfig.enableConfigInDatabase){
    // Check if using deprecated variable and log warning
    if(process.env.ENABLE_FORMS_YAML_IN_DATABASE !== undefined && process.env.ENABLE_CONFIG_IN_DATABASE === undefined){
      logger.warning("ENABLE_FORMS_YAML_IN_DATABASE is deprecated. Please use ENABLE_CONFIG_IN_DATABASE instead.")
    }
    
    const settings = await Settings.findFormsYaml()    
    // if not empty
    if(settings.forms_yaml.trim()){
      logger.info(`Using config from database`)      
      rawdata = settings.forms_yaml // loading from db
    }else{
      logger.warning("No config found in the database, falling back to disk file")
    }
  }

  if(!rawdata){
    // Get the config path (with legacy fallback)
    const configInfo = await getConfigPath();
    const configPath = configInfo.path;
    deprecationMessage = configInfo.deprecationMessage;
    
    // Create config.yaml from template if it doesn't exist
    if (!fs.existsSync(configPath)) {
      copyConfigTemplate(configPath);
    }
    
    // Also ensure the forms directory exists
    if (!fs.existsSync(formsPath)) {
      copyFormsDirectoryTemplate(formsPath);
    }
    // at this point we have a config file and forms directory

    if (appConfig.useYtt) {
      // try to process ytt
      try{
        const yttLibDir=path.join(path.dirname(configPath),"/lib");
        rawdata = execYtt(configPath,yttLibDir);
      } catch (e) {
        logger.error(`Failed to load '${configPath}' with ytt.`,e);
        throw new Error(Helpers.getError(e,"Error processing the config file with ytt."))
      }
    } else {
      // try to read the file
      try{
        logger.info(`Using config from file: ${configPath}`)      
        rawdata = fs.readFileSync(configPath, 'utf8');
      } catch (e) {
        logger.error(`Failed to load '${configPath}'.`,e);
        throw new Error(Helpers.getError(e,"Error reading the config file."))
      }
    }
  }

  // now let's see if it's valid yaml
  try{
    const config = yaml.parse(rawdata)
    logger.debug("Base config loaded and is valid YAML")
    return { config, deprecationMessage };
  }catch(err){
    logger.error("Error",err)
    throw new Error(Helpers.getError(err,"Error parsing the base config, it's not valid yaml."))
  }  
}

async function loadVarsFiles(varsFiles) {
  if (!varsFiles || !Array.isArray(varsFiles) || varsFiles.length === 0) {
    return {};
  }

  let mergedVars = {};
  
  // Get vars files path from repository or default local path
  const varsFilesPath = await Repository.getVarsFilesPath();

  for (const varsFile of varsFiles) {
    // Support both absolute and relative paths
    // Relative paths are resolved against vars files path (from repository or local)
    const absPath = path.isAbsolute(varsFile) 
      ? path.resolve(varsFile)
      : path.resolve(varsFilesPath, varsFile);
    
    const ext = path.extname(absPath).toLowerCase();
    // Validate file extension
    if (ext !== '.yml' && ext !== '.yaml') {
      logger.warning(`Skipping varsFile '${varsFile}': must end with .yml or .yaml`);
      continue;
    }

    try {
      logger.debug(`Loading varsFile: ${varsFile} (resolved to ${absPath})`);

      const rawData = fs.readFileSync(absPath, 'utf8');
      const data = yaml.parse(rawData);

      // Validate that the file contains a dict/object
      if (typeof data !== 'object' || Array.isArray(data)) {
        logger.warning(`Skipping varsFile '${varsFile}': content must be a dictionary, not ${Array.isArray(data) ? 'a list' : typeof data}`);
        continue;
      }

      // Deep merge with existing vars
      mergedVars = _.merge(mergedVars, data);
      logger.debug(`Successfully loaded and merged varsFile: ${varsFile}`);
    } catch (err) {
      logger.error(`Failed to load varsFile '${varsFile}': ${err.message}`);
      // Continue with other files even if one fails
    }
  }

  return mergedVars;
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
      tileClass: form.tileClass || '',
      order: form.order ?? Number.MAX_SAFE_INTEGER,
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
  
  // Get forms folder paths - can be multiple from repositories or single default path
  const repoFormsPaths = (await Repository.getFormsFolderPath()) || []
  const formsdirpaths = repoFormsPaths.length > 0 ? repoFormsPaths : [appConfig.formsFolderPath]
  
  logger.debug(`Loading forms from ${formsdirpaths.length} folder(s): ${formsdirpaths.join(", ")}`)

  function warn(message) {
    logger.warning(message);
    warnings.push(message);
  }
  function error(message) {
    logger.error(message);
    errors.push(message);
  }
  // let's load the base config
  const { config: unvalidatedBase, deprecationMessage } = await getBaseConfig();
  
  // Add deprecation warning if using legacy forms.yaml
  if (deprecationMessage) {
    warn(deprecationMessage);
  }
  
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
    warn("Found forms in base config file. This is DEPRECATED. Please move forms to the forms/ folder.")
  }
  // set source to base (no source)
  for(let f of unvalidatedForms){
    delete f.source // remove source from the base forms, it is not needed
  };
  
  // read extra form files from all forms directories
  // Loop through each forms directory path
  for(const formsdirpath of formsdirpaths){
    var files = [];
    try {
      // walk directory recursively and collect relative paths for .yml/.yaml files
      const walk = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.yml' || ext === '.yaml') {
              // store path relative to formsdirpath so getFormsFromFile(formsdirpath, relPath) works
              const rel = path.relative(formsdirpath, fullPath);
              files.push(rel);
            }
          }
        }
      };
      if (fs.existsSync(formsdirpath)) {
        walk(formsdirpath);
      } else {
        warn(`Failed to load forms directory '${formsdirpath}'.`);
        continue; // skip this directory
      }
    } catch (e) {
      warn(`Failed to load forms directory '${formsdirpath}'.`, e);
      continue; // skip this directory
    }

    if (files && files.length) {
      logger.debug(`Found ${files.length} form file(s) in '${formsdirpath}'`)
      // sort for deterministic order
      files.sort();
      // read files
      for (const item of files) {
        // read the file and add to the forms array
        logger.debug(`Loading forms from file ${item} in ${formsdirpath}`);
        try{
          unvalidatedForms = unvalidatedForms.concat(getFormsFromFile(formsdirpath,item)); // get the forms from the file, including subpaths
        }
        catch (e) {
          error(e.message);
        }
      };
    }
  }
  
  // Process all collected forms
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
        if(formName) { // if we are looking for a specific form, and no access, throw an error
          throw new Errors.AccessDeniedError(`Access denied to form ${f.name}.`); 
        } 
        continue // skip this form if user has no access to it
      }
      existingFormNames.push(f.name) // collect all form names        
      logger.debug(`adding form ${f.name}`)
      try{
        form = getFormInfo(f,formName,loadFullConfig); // retreive only the necessary form info
      } catch (e) {
        // convert e to proper string
        error(`Failed to validate form '${f.name}'.\r\n${e.message}`);
      }  
      if(form){
        // Load varsFiles if this is a single form request and varsFiles is defined
        if(formName && form.varsFiles){
          logger.debug(`Loading varsFiles for form ${f.name}`);
          try {
            form.vars = await loadVarsFiles(form.varsFiles);
          } catch (e) {
            error(`Failed to load varsFiles for form '${f.name}'.\r\n${e.message}`);
          }
        }
        baseConfig.forms.push(form);   // merge the form into the base forms
        // if we are loading full config, we can return the form right away
        if(formName){
          baseConfig.errors = errors; // add errors to the base config
          baseConfig.warnings = warnings; // add warnings to the base config
          return baseConfig // exit early if we found the form we are looking for
        }                
      }
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
    const validate = ajv.compile(baseSchema)
    const valid = validate(obj)

    if (!valid){
      var ajvMessages = AJVErrorParser.parseErrors(validate.errors)
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

    logger.debug("validating form against schema")
    const validate = ajv.compile(formSchema)
    const valid = validate(obj)
    if (!valid){
      var ajvMessages = AJVErrorParser.parseErrors(validate.errors)
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
      logger.debug("Validated")
      return obj
    }
  }
}
Form.validate = function(forms){
  if(forms){
    logger.debug("validating forms.yaml against schema")
    const validate = ajv.compile(formsSchema)
    const valid = validate(forms)
    if (!valid){
      var ajvMessages = AJVErrorParser.parseErrors(validate.errors)
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
  logger.info("Making backup of config and forms")
  var timestamp=moment().format("YYYYMMDDkkmmssSSS")
  var backupformsdir=formsBackupPath +".bak."+timestamp
  var backupconfigfile=configFileBackupPath +".bak."+timestamp
  var backuplegacyformsfile=legacyFormFileBackupPath +".bak."+timestamp
  var backupfile=path.parse(backupconfigfile).base
  Form.removeOld(oldBackupDays)
  
  // Back up config.yaml (new structure)
  if(fs.existsSync(appConfig.configPath)){
    logger.debug(`Copying config file '${appConfig.configPath}'->'${backupconfigfile}'`)
    fse.copySync(appConfig.configPath,backupconfigfile)
  }
  
  // Back up forms.yaml (legacy - for backward compatibility)
  if(fs.existsSync(appConfig.formsPath)){
    logger.debug(`Copying legacy forms file '${appConfig.formsPath}'->'${backuplegacyformsfile}'`)
    fse.copySync(appConfig.formsPath,backuplegacyformsfile)
  }
  
  // Back up forms directory
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
  logger.debug(`Removing old backup '${backupName}'`)
  var backupformsdir=formsBackupPath+getBackupSuffix(backupName)
  var backupconfigfile=configFileBackupPath+getBackupSuffix(backupName)
  var backuplegacyformsfile=legacyFormFileBackupPath+getBackupSuffix(backupName)
  
  // Remove config.yaml backup
  if(fs.existsSync(backupconfigfile)){
    logger.debug(`Removing config file '${backupconfigfile}'`)
    fse.removeSync(backupconfigfile)
  }
  
  // Remove legacy forms.yaml backup
  if(fs.existsSync(backuplegacyformsfile)){
    logger.debug(`Removing legacy forms file '${backuplegacyformsfile}'`)
    fse.removeSync(backuplegacyformsfile)
  }
  
  // Remove forms directory backup
  if(fs.existsSync(backupformsdir)){
    logger.debug(`Removing forms directory '${backupformsdir}'`)
    fse.removeSync(backupformsdir)
  }
}
Form.restoreBackup = function(backupName){
  var backupformsdir=formsBackupPath+getBackupSuffix(backupName)
  var backupconfigfile=configFileBackupPath+getBackupSuffix(backupName)
  var backuplegacyformsfile=legacyFormFileBackupPath+getBackupSuffix(backupName)
  
  // Restore config.yaml
  if(fs.existsSync(backupconfigfile)){
    logger.debug(`Copying config file '${backupconfigfile}'->'${appConfig.configPath}'`)
    fse.copySync(backupconfigfile,appConfig.configPath)
  }
  
  // Restore legacy forms.yaml (if it exists in backup)
  if(fs.existsSync(backuplegacyformsfile)){
    logger.debug(`Copying legacy forms file '${backuplegacyformsfile}'->'${appConfig.formsPath}'`)
    fse.copySync(backuplegacyformsfile,appConfig.formsPath)
  }
  
  // Restore forms directory
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
        // ensure parent directory exists for nested paths
        fse.ensureDirSync(path.dirname(tmpfile));
        fs.writeFileSync(tmpfile,yaml.stringify(forms[0]));
      }
      if(forms.length>1){
        logger.debug(`saving forms ${formnames} to '${tmpfile}'`)
        // ensure parent directory exists for nested paths
        fse.ensureDirSync(path.dirname(tmpfile));
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
    var files = fs.readdirSync(legacyFormFilePath)
    if(files){
      // filter only backup-files and folders
      files=files.filter((item)=>item.match(/\.bak\.[0-9]*$/))
      // read files
      for(const item of files){
        try{
          const from = path.join(legacyFormFilePath,item)
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