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

Repo.findAll = function (callback) {
  try{
    var directory = config.repoPath
    var repos
    try{
      fs.accessSync(directory)
    }catch(e){
      try{
        logger.info("Force creating path : " + directory)
        fs.mkdirSync(directory, { recursive: true,force:true });
      }catch(err){
        logger.error(err)
        callback(err)
        return false
      }
    }
    repos = fs.readdirSync(directory, { withFileTypes: true })
      .filter(dir => dir.isDirectory())
      .map(dir => dir.name)
    callback(null,repos)
  }catch(e){
    logger.error(e)
    callback(e)
  }
}
Repo.delete = function (name,callback) {
  try{
    logger.info("Deleting repository " + name)
    var directory = config.repoPath
    try{
      fs.accessSync(path.join(directory,name))
    }catch(e){
      callback(e)
      return false
    }
    fs.rmSync(path.join(directory,name),{force:true,recursive:true})
    callback(null,true)
  }catch(e){
    logger.error(e)
    callback(e)
  }
}
Repo.findByName = function (name,text,callback) {
  try{
    var directory = config.repoPath
    directory=path.join(directory,name)
    try{
      fs.accessSync(directory)
    }catch(e){
      callback(e)
      return false
    }
    var clone = exec(`git remote show origin && git log -n 1`,{cwd:directory})
    var output=[]
    if(!text){
      output.push(`<h1 class='subtitle'>${directory}</h1>`)
    }else{
      output.push(directory)
    }

    clone.stdout.on('data', function(a){
      // logger.sill(a)
      output.push(a)
    });

    clone.on('exit',function(code){
      logger.silly('exit')
      if(code==0){
        if(!text){
          callback(null,Repo.color(output))
        }else {
          callback(null,output.join("\r\n"))
        }
      }else{
        callback(`Getting repo failed with code ${code}`,output.join("\r\n"))
      }
    });

    clone.stderr.on('data',function(a){
      output.push(a)
      logger.error('stderr:'+a);
    });
  }catch(e){
    logger.error(e)
    callback(e)
  }
}

// run git clone
Repo.create = function (repo, callback) {
  try{
    logger.info("Creating repository " + repo)
    var directory = config.repoPath
    try{
      fs.accessSync(directory)
    }catch(e){
      try{
        logger.info("Force creating path : " + directory)
        fs.mkdirSync(directory, { recursive: true,force:true });
      }catch(err){
        logger.error(err)
        callback(err)
        return false
      }
    }
    var clone = exec(`git clone ${repo}`,{cwd:directory})
    var output = []
    clone.stdout.on('data', function(a){
      logger.debug(a)
      output.push(a)
    });

    clone.on('exit',function(code){
      logger.silly('exit')
      if(output.length>0 && code==0){
        callback(null,output.join("\r\n"))
      }else{
        callback(`\ncreating repository failed with code ${code}\n${output.join("\n")}`)
      }
    });

    clone.stderr.on('data',function(a){
      output.push(a)
      logger.error('stderr:'+a);
    });
  }catch(e){
    logger.error(e)
    callback(e)
  }
};
module.exports= Repo;
