'use strict';
const exec = require('child_process').exec;
const Cmd = require("../lib/cmd")
const logger=require("../lib/logger")
const path=require("path")
const fs=require("fs")
var config=require('../../config/app.config')

const Repo={

}

Repo.maskGitToken =(data)=>{
  if(data){
    try{
      // console.log(data.toString())
      var masked = data.toString().replace(/(http[s]{0,1}):\/\/([^:]+):([^@]+)@(.*)/gm,"$1://$2:*******@$4")
      // console.log("==> " + rep)
      return masked
    }catch(e){
      logger.error("Failed to maskGitToken : ",e)
      return data
    }
  }else{
    return data
  }
}

Repo.color = function(t){
  return ([].concat(t)).map(x=> x.replace(/^([^:\n\r]+:)/gm,"<strong class='has-text-info'>$1</strong>")).join("\r\n")
}

Repo.delete = async function (name) {

    logger.notice("Deleting repository " + name)
    var directory = config.repoPath

    fs.accessSync(path.join(directory,name))
    // if found and access continue with delete
    fs.rmSync(path.join(directory,name),{force:true,recursive:true})
    return

}

// run git clone
Repo.info = async function (name) {

    // logger.notice(`Git repository info : ${name}`)
    var directory = path.join(config.repoPath,name)
  
    var cmd
    if(name){
      cmd = `git rev-parse --short HEAD`
    }else{
      throw new Error("No name given")
    }
    return await Cmd.executeSilentCommand({command:cmd,directory:directory,description:"Getting repository info"},true,true)

};

// run git clone
Repo.clone = async function (uri,name,branch=undefined) {

    var directory = config.repoPath
    var exists = true
    try{
      fs.accessSync(path.join(directory,name))
    }catch(e){  
      exists=false    
    }      
    if(exists){
      logger.notice("Repository already exists, pulling instead")
      return await Repo.pull(name)
    }else{
      logger.notice(`Cloning repository : ${Exec.maskGitToken(uri)}`)
      try{
        fs.accessSync(config.repoPath)
      }catch(e){
        try{
          logger.notice("Force creating path : " + directory)
          fs.mkdirSync(directory, { recursive: true,force:true });
        }catch(err){
          logger.error("Failed to create the path : ", err)
          throw err
        }
      }

      var cmd
      if(uri){
        if(branch){
          cmd = `git clone -b ${branch} --verbose ${uri} ${name}`
        }else{
          cmd = `git clone --verbose ${uri} ${name}`
        }
      }else{
        throw new Error("No uri given")
      }

      var hostRegex = new RegExp(".*@([^:]+):.*", "g");

      var match = hostRegex.exec(cmd);
      if(match && uri){
        var host = match[1]
        logger.notice(`Found host in command : ${host}; adding it to known_hosts`)
        cmd = `ssh-keyscan ${host} >> ~/.ssh/known_hosts ; ${cmd}`
      }else{
        logger.warning(`No host found in command`)
      }
      var maskedCommand = Repo.maskGitToken(cmd)
      return await Cmd.executeSilentCommand({command:cmd,directory:directory,description:"Cloning repository",maskedCommand:maskedCommand})

    }
};
// add ssh known hosts
Repo.addKnownHosts = async function (hosts) {

    if(!hosts){
      throw new Error("No hosts given")
    }else{
      logger.notice(`Adding keys for hosts ${hosts}`)
      var cmd = `ssh-keyscan ${hosts} >> ~/.ssh/known_hosts`
      logger.notice(`Running cmd : ${cmd}`)
      var known_hosts = exec(cmd,{})
      var output = []
      known_hosts.stdout.on('data', function(a){
        logger.info(a)
        output.push(a)
      });

      known_hosts.on('exit',function(code){
        logger.debug('exit')
        if(code==0){
          return `Adding keys ran succesfully\n${output.join("\n")}`
        }else{
          throw new Error(`\nAdding keys failed with code ${code}\n${output.join("\n")}`)
        }
      });

      known_hosts.stderr.on('data',function(a){
        output.push(a)
        logger.error('stderr:'+a);
      });
    }

};

// run a playbook
Repo.pull = async function (name) {
      var command = "git pull --verbose"
      var directory = path.join(config.repoPath,name)
      return await Cmd.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"},true)
};
module.exports= Repo;
