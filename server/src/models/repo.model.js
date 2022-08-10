'use strict';
const exec = require('child_process').exec;
const logger=require("../lib/logger")
const path=require("path")
const fs=require("fs")
var config=require('../../config/app.config')

const Repo={

}

Repo.color = function(t){
  return ([].concat(t)).map(x=> x.replace(/^([^:\n\r]+:)/gm,"<strong class='has-text-info'>$1</strong>")).join("\r\n")
}

Repo.findAll = function () {
  return new Promise((resolve,reject)=>{
    var directory = config.repoPath
    var repos
    try{
      try{
        fs.accessSync(directory)
      }catch(e){
        try{
          logger.notice("Force creating path : " + directory)
          fs.mkdirSync(directory, { recursive: true,force:true });
        }catch(err){
          logger.error(err)
          reject(err)
          return;
        }
      }
      repos = fs.readdirSync(directory, { withFileTypes: true })
        .filter(dir => dir.isDirectory())
        .map(dir => dir.name)
    }catch(err){
      logger.error(err)
      reject(err)
      return;
    }
    resolve(repos)
  })
}
Repo.delete = function (name) {
  return new Promise((resolve,reject)=>{
    logger.notice("Deleting repository " + name)
    var directory = config.repoPath
    try{
      fs.accessSync(path.join(directory,name))
      // if found and access continue with delete
      fs.rmSync(path.join(directory,name),{force:true,recursive:true})
      resolve()
    }catch(e){
      // not found - we don't fail and don't delete
      logger.error(e)
      reject(e)
    }
  })

}
Repo.findByName = function (name,text){
  return new Promise((resolve,reject)=>{
    try{
      var directory = config.repoPath
      directory=path.join(directory,name)
      try{
        fs.accessSync(directory)
      }catch(e){
        reject(e)
        return;
      }
      var info = exec(`git remote show origin && git log -n 1`,{cwd:directory})
      var output=[]
      if(!text){
        output.push(`<h1 class='subtitle'>${directory}</h1>`)
      }else{
        output.push(directory)
      }

      info.stdout.on('data', function(a){
        // logger.sill(a)
        output.push(a)
      });

      info.on('exit',function(code){
        logger.debug('exit')
        if(code==0){
          if(!text){
            resolve(Repo.color(output))
          }else {
            resolve(output.join("\r\n"))
          }
        }else{
          reject(`Getting repo failed with code ${code}`,output.join("\r\n"))
        }
      });

      info.stderr.on('data',function(a){
        output.push(a)
        logger.error('stderr:'+a);
      });
    }catch(e){
      logger.error(e)
      reject(e)
    }
  })
}

// run git clone
Repo.create = function (uri,command,username,email) {
  return new Promise((resolve,reject)=>{
    try{
      logger.notice("Creating repository " + (uri)?uri:command)
      var directory = config.repoPath
      try{
        fs.accessSync(directory)
      }catch(e){
        try{
          logger.notice("Force creating path : " + directory)
          fs.mkdirSync(directory, { recursive: true,force:true });
        }catch(err){
          logger.error(err)
          reject(err)
          return;
        }
      }
      var clone
      var cmd
      if(uri){
        cmd = `git clone --verbose ${uri}`
      }else if(command){
        cmd = command
      }else{
        reject("No uri or command given")
        return;
      }
      var repoNameRegex = new RegExp(".*/([^\.]+)\.git.*", "g");
      var match = repoNameRegex.exec(uri);
      if(match){
        var repoName = match[1]
        logger.notice(`Found repoName in command : ${repoName}`)
        cmd = `${cmd} ; cd ${repoName}`
      }else{
        logger.error(`No repo name found in uri`)
      }
      if(username){
        cmd = `${cmd} ; git config user.name "${username}"`
      }
      if(email){
        cmd = `${cmd}; git config user.email ${email}`
      }
      var hostRegex = new RegExp(".*@([^:]+):.*", "g");
      var match = hostRegex.exec(cmd);
      if(match){
        var host = match[1]
        logger.notice(`Found host in command : ${host}; adding it to known_hosts`)
        cmd = `ssh-keyscan ${host} >> ~/.ssh/known_hosts ; ${cmd}`
      }else{
        logger.error(`No host found in command`)
      }

      logger.notice(`Running cmd : ${cmd}`)
      var clone = exec(cmd,{cwd:directory})
      var output = []
      clone.stdout.on('data', function(a){
        logger.info(a)
        output.push(a)
      });

      clone.on('exit',function(code){
        logger.debug('exit')
        if(code==0){
          resolve(`repository created succesfully`)
        }else{
          reject(`\ncreating repository failed with code ${code}\n${output.join("\n")}`)
        }
      });

      clone.stderr.on('data',function(a){
        output.push(a)
        logger.error('stderr:'+a);
      });
    }catch(e){
      logger.error(e)
      reject(e)
    }
  })
};
// add ssh known hosts
Repo.addKnownHosts = function (hosts) {
  return new Promise((resolve,reject)=>{
    try{
      if(!hosts){
        reject("No hosts given")
        return;
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
            resolve(`Adding keys ran succesfully\n${output.join("\n")}`)
            return;
          }else{
            reject(`\nAdding keys failed with code ${code}\n${output.join("\n")}`)
            return;
          }
        });

        known_hosts.stderr.on('data',function(a){
          output.push(a)
          logger.error('stderr:'+a);
        });
      }
    }catch(e){
      logger.error(e)
      reject(e)
      return;
    }
  })
};
module.exports= Repo;
