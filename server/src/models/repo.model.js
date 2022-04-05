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
    try{
      var directory = config.repoPath
      var repos
      try{
        fs.accessSync(directory)
      }catch(e){
        try{
          logger.notice("Force creating path : " + directory)
          fs.mkdirSync(directory, { recursive: true,force:true });
        }catch(err){
          logger.error(err)
          reject(err)
        }
      }
      repos = fs.readdirSync(directory, { withFileTypes: true })
        .filter(dir => dir.isDirectory())
        .map(dir => dir.name)
      resolve(repos)
    }catch(e){
      logger.error(e)
      reject(e)
    }
  })

}
Repo.delete = function (name) {
  return new Promise((resolve,reject)=>{
    try{
      logger.notice("Deleting repository " + name)
      var directory = config.repoPath
      try{
        fs.accessSync(path.join(directory,name))
      }catch(e){
        reject(e)
      }
      fs.rmSync(path.join(directory,name),{force:true,recursive:true})
      resolve()
    }catch(e){
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
Repo.create = function (uri,command) {
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
        }
      }
      var clone
      var cmd
      if(uri){
        cmd = `git clone --verbose --quiet ${uri}`
      }else if(command){
        cmd = command
      }else{
        reject("No uri or command given")
      }
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
module.exports= Repo;
