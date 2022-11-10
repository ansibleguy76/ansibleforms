'use strict';
const appConfig = require('./../../config/app.config');
const logger=require("../lib/logger")
const fs=require("fs")
const os=require("os")
const fse=require("fs-extra")
const moment=require("moment")
const YAML=require("yaml")
const Ajv = require('ajv');
const ajv = new Ajv()
const path=require("path")
const AJVErrorParser = require('ajv-error-parser');

function getFormsDir(){
  return path.join(path.dirname(appConfig.formsPath),"/forms");
}
function getBackupSuffix(t){
  var backuppartre=new RegExp("(\.bak\.[0-9]{17})$","g")
  var backuppart=backuppartre.exec(t)[1]
  return backuppart
}
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
var Form=function(data){
  this.forms = data.forms;
};
// load the forms config
Form.load = function() {
  logger.info(`Loading ${appConfig.formsPath}`)
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
      logger.warning("No forms directory... loading only forms.yaml")
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
    logger.error(err)
    throw err
  }
};
// load the forms config
Form.backups = function() {
  logger.info(`Loading backups`)
  var files=undefined
  var backups=[]
  try{
    files = fs.readdirSync(path.dirname(appConfig.formsPath))
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
    logger.info("Parsing yaml data")
    formsConfig = YAML.parse(data.forms,{prettyErrors:true})
  }catch(err){
    logger.error(err.toString())
    throw ("failed to parse yaml : " + err.toString())
  }
  return formsConfig
}
Form.removeOld=function(days=60){
  var files = fs.readdirSync(path.dirname(appConfig.formsPath))
  if(files && files.length){
    // filter only backup yamls
    files=files.filter((item)=>item.match(/y[a]{0,1}ml\.bak\.[0-9]{17}$/g))
    // read files
    files.forEach((file, i) => {
      var item=file.substring(file.length-17) // get time part
      var iso=moment(item.slice(0,8)) // get date part
      var old=moment().diff(moment(iso),"days") // how old ?
      if(old>days){ // date is older than x days ?
        Form.remove(file) // remove backup
      }else{
        //logger.debug(`Keeping ${file} [${old} days]`)
      }
    });
  }
}
Form.backup = function(){
  logger.info("Making backup of forms")
  var formsdir=getFormsDir()
  var today=moment()
  var timestamp=moment().format("YYYYMMDDkkmmssSSS")
  var backupformsdir=formsdir+".bak."+timestamp
  var backupformsfile=appConfig.formsPath+".bak."+timestamp
  var backupfile=path.parse(backupformsfile).base
  Form.removeOld(10)
  logger.debug(`Copying forms file '${appConfig.formsPath}'->'${backupformsfile}'`)
  fse.copySync(appConfig.formsPath,backupformsfile)
  if(fs.existsSync(formsdir)){
    logger.debug(`Copying forms directory '${formsdir}'->'${backupformsdir}'`)
    fse.removeSync(backupformsdir) // just in case, remove it (unlikely hit)
    fse.ensureDirSync(backupformsdir) // make backupdir
    fse.copySync(formsdir,backupformsdir) // make backup
  }
  return backupfile
}
Form.remove = function(backupName){
  var formsdir=getFormsDir()
  var basedir=path.dirname(appConfig.formsPath)
  var backupformsdir=formsdir+getBackupSuffix(backupName)
  var backupformsfile=path.join(basedir,backupName)
  logger.debug(`Removing forms file '${backupformsfile}'`)
  fse.removeSync(backupformsfile)
  if(fs.existsSync(backupformsdir)){
    logger.debug(`Removing forms directory '${backupformsdir}'`)
    fse.removeSync(backupformsfile)
  }
}
Form.restoreBackup = function(backupName){
  var formsdir=getFormsDir()
  var basedir=path.dirname(appConfig.formsPath)
  var backupformsdir=formsdir+getBackupSuffix(backupName)
  var backupformsfile=path.join(basedir,backupName)
  logger.debug(`Copying forms file '${backupformsfile}'->'${appConfig.formsPath}'`)
  fse.copySync(backupformsfile,appConfig.formsPath)
  if(fs.existsSync(backupformsdir)){
    logger.debug(`Copying forms directory '${backupformsdir}'->'${formsdir}'`)
    fse.removeSync(formsdir) // just in case, remove it (unlikely hit)
    fse.ensureDirSync(formsdir) // make backupdir
    fse.copySync(backupformsdir,formsdir) // make backup
  }
}
Form.save = function(data){
  var formsConfig = Form.parse(data)
  var formsdir=getFormsDir()
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
    logger.debug(`Copy tmp directory '${tmpDir}'->'${formsdir}'`)
    fse.emptyDirSync(formsdir) // empty formsdir
    fse.copySync(tmpDir,formsdir) // copy from temp

    logger.debug(`Writing base file '${appConfig.formsPath}'`)
    fs.writeFileSync(appConfig.formsPath,YAML.stringify(formsConfig)); // write basefile
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
        logger.debug(`Cleaning up folder '${tmpDir}'`)
        //fs.rmSync(tmpDir, { recursive: true });
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
Form.loadByName = function(form,user,forApproval=false){
  var forms = Form.load()
  var formObj = forms?.forms.filter(x => x.name==form)
  if(formObj.length>0){
    if(forApproval){
      return formObj[0]
    }
    logger.debug(`Form ${form} is found, checking access...`)
    var access = formObj[0].roles.filter(role => user?.roles?.includes(role))
    if(access.length>0 || user?.roles?.includes("admin")){
      return formObj[0]
      logger.debug(`Form ${form}, access allowed...`)
    }else {
      logger.warning(`Form ${form}, no access...`)
      return null
    }
  }else{
    return null
  }

}
module.exports= Form;
