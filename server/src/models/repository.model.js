'use strict';
const logger=require("../lib/logger");
const mysql=require("./db.model");
const {encrypt,decrypt}=require("../lib/crypto")
const NodeCache = require("node-cache")
const Repo = require("./repo.model")
const path=require("path")
const fs=require("fs")
const appConfig = require("../../config/app.config")

const cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});


//repository object create
var Repository=function(repository){
    this.name = repository.name;
    this.uri = repository.uri;
    this.cron = repository.cron;
    this.user = repository.user;
    this.branch = repository.branch; // added in 5.0.8
    this.use_for_forms = (repository.use_for_forms)?1:0;
    this.rebase_on_start = (repository.rebase_on_start)?1:0;    
    this.use_for_playbooks = (repository.use_for_playbooks)?1:0;
    this.password = encrypt(repository.password);
    this.description = repository.description || "";
};

Repository.create = function (record) {
    logger.info(`Creating repository ${record.name}`)
    return mysql.do("INSERT INTO AnsibleForms.`repositories` set ?", record)
    .then((res)=>{ 
      Repository.clone(record.name)
      return res.insertId 
    })
};
Repository.update = function (record,name) {
    logger.info(`Updating repository ${name}`)
    return mysql.do("UPDATE AnsibleForms.`repositories` set ? WHERE name=?", [record,name])
    .then((res)=>{
      cache.del(record.name)
      Repository.clone(record.name)
      return res
    })
};
Repository.reset = async function(name){
  logger.info(`Resetting repository ${name}`)
  await Repo.delete(name) // delete the repo on disk
  await Repository.clone(name) // recreate the repo
}
Repository.delete = function(name){
    logger.info(`Deleting repository ${name}`)
    Repo.delete(name)
    return mysql.do("DELETE FROM AnsibleForms.`repositories` WHERE name = ?", [name])
};
Repository.findAll = function () {
    // logger.info("Finding all repositories")
    return mysql.do("SELECT id,name,branch,user,uri,description,use_for_forms,use_for_playbooks,cron,status,output,head,rebase_on_start FROM AnsibleForms.`repositories`;",undefined,true)
};
// Repository.findById = function (id) {
//     logger.info(`Finding repository ${id}`)
//     return mysql.do("SELECT * FROM AnsibleForms.`repositories` WHERE id=?;",id)
//     .then((res)=>{
//       if(res.length>0){
//         try{
//           res[0].password = decrypt(res[0].password)
//         }catch(e){
//           logger.error("Failed to decrypt the password.  Did the secretkey change ?")
//           res[0].password = ""
//         }
//         return res
//       }else{
//         throw `No repository found with id ${id}`
//       }
//     })
// };
Repository.getPrivateUri = function(repo){
  if(repo.uri){
    if(repo.user && repo.password){
      var httpRegex = new RegExp("^http[s]{0,1}:\/\/[^@]+$", "g");

      var match = httpRegex.exec(repo.uri);
      if(match){
        var privateUri = repo.uri.replace(/(http[s]{0,1}):\/\/(.*)/gm,`$1://${repo.user}:${repo.password}@$2`)
        return privateUri
      }else{
        logger.debug("Not an http uri")
        return repo.uri
      }
  
    }else{
      return repo.uri
    }

  }else{
    logger.warning("No uri defined")
    return ""
  }
}
Repository.findByName = async function (name) {
  logger.debug(`Finding repository ${name}`)

  var result
  var sql = "SELECT * FROM AnsibleForms.`repositories` WHERE name = ?"
  var res = await mysql.do(sql,name)
  if(res.length>0){
    result = res[0]
    if(result.password){
      try{
        result.password = decrypt(result.password)
      }catch(e){
        logger.error("Failed to decrypt the password.  Did the secretkey change ?")
        result.password = ""
      }
    }
    return JSON.parse(JSON.stringify(result))      
  }else{
    throw new Error("No repository found with name " + name)
  }

};
Repository.hasFormsRepository = async function(){
  try{
    var repositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_forms")
    return (repositories.length>0)
  }catch(e){
    logger.error("Failed to check repositories : ",e)
    return false
  }
}
Repository.getFormsPath = async function(){
  try{
    var repositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_forms")
  }catch(e){
    logger.error("Failed to get repositories.",e)
    return ""
  }    
  if(repositories.length>0){
    var repoPath = path.join(appConfig.repoPath,repositories[0].name)
    return path.join(repoPath,"forms.yaml")
  }
  return ""

}
Repository.getAnsiblePath = async function(){
  try{
    var repositories = await mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE use_for_playbooks")
    if(repositories.length>0){
      return path.join(appConfig.repoPath,repositories[0].name)
    }
    return ""
  }catch(e){
    logger.error("Failed to get ansible path : ",e)
    return ""
  }
}
Repository.clone = async function(name){
    var output,status,head
    try{
      await mysql.do("update AnsibleForms.`repositories` set status = ? where name = ?",["running",name])
      var repo = await Repository.findByName(name)
      var uri = Repository.getPrivateUri(repo)
      var branch = repo.branch || undefined
      output = await Repo.clone(uri,name,branch)
      status="success"
    }catch(e){
      output = e.message
      status="failed"
    }
    await mysql.do("update AnsibleForms.`repositories` set output = ?,status = ? where name = ?",[output,status,name])
    if(status=="success"){
      head = await Repo.info(name)
      await mysql.do("update AnsibleForms.`repositories` set head = ? where name = ?",[head,name])
    }
}
Repository.pull = async function(name){
  var output,status,head
  try{
    await mysql.do("update AnsibleForms.`repositories` set status = ? where name = ?",["running",name])
    output = await Repo.pull(name)
    status="success"
  }catch(e){
    output = e.message
    status="failed"
  }
  await mysql.do("update AnsibleForms.`repositories` set output = ?,status = ? where name = ?",[output,status,name])
  if(status=="success"){
    head = await Repo.info(name)
    await mysql.do("update AnsibleForms.`repositories` set head = ? where name = ?",[head,name])
  }
}

module.exports= Repository;
