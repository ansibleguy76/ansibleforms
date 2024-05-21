'use strict';
const appConfig = require('./../../config/app.config');
const logger=require("../lib/logger")
const fs=require("fs")
const os=require("os")
const fse=require("fs-extra")
const moment=require("moment")
const execSync = require('child_process').execSync;
const YAML=require("yaml")
const Ajv = require('ajv');
const ajv = new Ajv()
const path=require("path")
const AJVErrorParser = require('ajv-error-parser');
const Repository = require('./repository.model')
const Helpers = require("../lib/common")

const backupPath = appConfig.formsBackupPath

const formFilePath = path.dirname(appConfig.formsPath)
const formFileName = path.basename(appConfig.formsPath)
const formsPath = path.join(formFilePath,"forms")
const formsBackupPath = path.join(backupPath,'forms')
const formFileBackupPath = path.join(backupPath,formFileName)
const oldBackupDays = appConfig.oldBackupDays

function getBackupSuffix(t){
  var backuppartre=new RegExp("(\.bak\.[0-9]{17})$","g")
  var backuppart=backuppartre.exec(t)[1]
  return backuppart
}
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
var Form=function(data){
  this.forms = data.forms;
};

/**
 * Compute ytt cli options for library data values based on provided env vars
 */
function getYttLibDataOpts() {
  var yttLibDataOpts = '';
  Object.entries(process.env).filter( ([key, value]) => key.startsWith('YTT_LIB_DATA_')).forEach( ([key, value]) => {
    const libName = key.replace('YTT_LIB_DATA_', '').toLowerCase();
    yttLibDataOpts += ` --data-values-file @${libName}:data=${value}`;
  });
  return yttLibDataOpts;
}

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
      files.forEach((item, i) => {
        try{
          const from = path.join(formFilePath,item)
          const to = path.join(backupPath,item)
          logger.debug(`moving ${from} -> ${to}`)
          fse.moveSync(from,to)
        }catch(e){
          logger.error(`failed to move item '${item}'.\n`,e)
        }
      });
    }
  }catch(e){
    logger.error("Failed to init backup folder\n",e)
  }  
  Form.removeOld(oldBackupDays)
}
// load the forms config
Form.load = async function() {


  var forms=undefined
  var rawdata=undefined
  var appFormsPath = (await Repository.getFormsPath()) || appConfig.formsPath
  logger.info(`Loading ${appFormsPath}`)  
  var formsdirpath=path.join(path.dirname(appFormsPath),"/forms");
  var formslibdirpath=path.join(path.dirname(appFormsPath),"/lib");
  var formfilesraw=[]
  var formfiles=[]
  var files=undefined

  var ytt_env_data_opt = ''
  if ('YTT_VARS_PREFIX' in process.env) {
    ytt_env_data_opt = ` --data-values-env ${process.env.YTT_VARS_PREFIX}`;
  }
  var yttLibDataOpts = getYttLibDataOpts();

  try{
    // read base forms.yaml
    rawdata = '';
    try {
      if (appConfig.useYtt) {
        logger.info(`interpreting ${appFormsPath} with ytt.`);
        logger.debug(`executing 'ytt -f ${appFormsPath} -f ${formslibdirpath}${ytt_env_data_opt}${yttLibDataOpts}'`)
        rawdata = execSync(
            `ytt -f ${appFormsPath} -f ${formslibdirpath}${ytt_env_data_opt}${yttLibDataOpts}`,
            {
              env: process.env,
              encoding: 'utf-8'
            }
        );
      } else {
        rawdata = fs.readFileSync(appFormsPath, 'utf8');
      }
    } catch (e) {
      logger.error(`failed to load '${appFormsPath}'.\n${e}`);
    }


    // read extra form files
    try{
      files = fs.readdirSync(formsdirpath)
      if(files){
        // filter only yaml
        files=files.filter((item)=>['.yaml','.yml'].includes(path.extname(item)))
        // read files
        files.forEach((item, i) => {
          try{
            var itemFormPath = path.join(formsdirpath, item);
            var itemRawData = '';
            if (appConfig.useYtt) {
              logger.info(`interpreting ${itemFormPath} with ytt.`);
              logger.debug(`executing 'ytt -f ${itemFormPath} -f ${formslibdirpath}${ytt_env_data_opt}'`)
              itemRawData = execSync(
                  `ytt -f ${itemFormPath} -f ${formslibdirpath}${ytt_env_data_opt}`,
                  {
                    env: process.env,
                    encoding: 'utf-8'
                  }
              );
            } else {
              itemRawData =fs.readFileSync(itemFormPath,'utf8');
            }
            formfilesraw.push({
              name: item,
              value: itemRawData
            })
          }catch(e){
            logger.error(`failed to load file '${item}'.\n${e}`);
          }
        });
      }
    }catch(e){
      logger.warning("No forms directory... loading only forms.yaml")
    }

  }catch(err){
    logger.error("Error : ",err)
    throw new Error(Helpers.getError(err,"Error reading the forms.yaml file"))
  }
  // parse base yaml
  try{
    forms = YAML.parse(rawdata)
  }catch(err){
    logger.error("Error",err)
    throw new Error(Helpers.getError(err,"Error parsing the forms.yaml file"))
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
      logger.info(`merging file ${item.name}`)
      try{
          var existing = forms.forms.map(x => x.name);
          [].concat(item.value||[]).forEach((f, i) => {
            if(!existing.includes(f.name)){
              logger.debug(`adding form ${f.name}`)
              f.source=item.name
              forms.forms.push(f)
            }else{
              logger.warning(`skipping existing form ${f.name}`)
            }
          });
      }catch(e){
        logger.error(`failed to merge file '${item.name}' into forms.yaml.\n${e}`)
      }
  });

  try{
    return Form.validate(forms)
  }catch(err){
    logger.error("Validation error : ", err)
    throw new Error(Helpers.getError(err,"Failed to validate forms"))
  }
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
Form.validate = function(forms){
  if(forms){
    var schema = require("../../schema/forms_schema.json")
    logger.debug("validating forms.yaml against schema")
    const valid = ajv.validate(schema, forms)
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
    formsConfig = YAML.parse(data.forms,{prettyErrors:true})
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
        fs.writeFileSync(tmpfile,YAML.stringify(forms[0]));
      }
      if(forms.length>1){
        logger.debug(`saving forms ${formnames} to '${tmpfile}'`)
        fs.writeFileSync(tmpfile,YAML.stringify(forms));
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
    fs.writeFileSync(appConfig.formsPath,YAML.stringify(formsConfig)); // write basefile
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
Form.loadByName = async function(form,user,forApproval=false){
  var forms = await Form.load()
  var formObj = forms?.forms.filter(x => x.name==form)
  if(formObj.length>0){
    if(forApproval){
      return formObj[0]
    }
    logger.debug(`Form ${form} is found, checking access...`)
    var access = formObj[0].roles.filter(role => user?.roles?.includes(role))
    if(access.length>0 || user?.roles?.includes("admin")){
      return formObj[0]
      //logger.debug(`Form ${form}, access allowed...`)
    }else {
      logger.warning(`Form ${form}, no access...`)
      return null
    }
  }else{
    return null
  }

}
module.exports= Form;
