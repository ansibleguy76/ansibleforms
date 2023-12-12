'use strict';
const exec = require('child_process').exec;
const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
const logger=require("../lib/logger")
const path=require("path")
const fs=require("fs")
var config=require('../../config/app.config')


var Exec=function(){}
// tree kill should do the trick, but fails in alpine
// so this piece of code does it
Exec.killChildren = (pid) => {
  const children = [];

  try {
    const psRes = execSync(`ps -opid="" -oppid="" |grep ${pid}`).toString().trim().split(/\n/);

    (psRes || []).forEach(pidGroup => {
      const [actual, parent] = pidGroup.trim().split(/ +/);

      if (parent.toString() === pid.toString()) {
        children.push(parseInt(actual, 10));
      }
    });
  } catch (e) {}
  try {
    logger.debug(`Killing process ${pid}`)
    process.kill(pid);
    children.forEach(childPid => Exec.killChildren(childPid));
  } catch (e) {}
};

Exec.maskGitToken =(data)=>{
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

Exec.executeSilentCommand = (cmd) => {

  return new Promise((resolve,reject)=>{
    var command = cmd.command
    var directory = cmd.directory
    var description = cmd.description
    // execute the procces
    logger.debug(`${description}, ${directory} > ${Exec.maskGitToken(command)}`)
    try{
      var cmdlist = command.split(' ')
      var basecmd = cmdlist[0]
      var parameters = cmdlist.slice(1)
      var child = spawn(basecmd,parameters,{shell:true,stdio:["ignore","pipe","pipe"],cwd:directory,detached:true});
      var timeout = setTimeout(()=>{
        Exec.killChildren(child.pid)
      },60000)
      var out=[]
      out.push(`Running command : ${Exec.maskGitToken(command)}`)
      // add output eventlistener to the process to save output
      child.stdout.on('data',function(data){
        // logger.debug(data)
        data = Exec.maskGitToken(data)
        out.push(data)
      })
      // add error eventlistener to the process to save output
      child.stderr.on('data',function(data){
        // save the output
        // logger.debug(data)
        data = Exec.maskGitToken(data)
        out.push(data)
      })
      // add exit eventlistener to the process to handle status update
      child.on('exit',function(data){
        clearTimeout(timeout)
        logger.info(description + " finished : " + data)
        if(data!=0){
          if(child.signalCode=='SIGTERM'){
            out.push("The command timed out")
          }
          reject(out.join('\n'))
        }else{
          resolve(out.join('\n'))
        }
      })
      // add error eventlistener to the process; set failed
      child.on('error',function(data){
        data = Exec.maskGitToken(data)
        logger.error(data)
        out.push(data)
        reject(out.join('\n'))
      })

    }catch(e){
      reject(e)
    }
  })

}


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
          logger.error("Failed to create the path : ", err)
          reject(err)
          return;
        }
      }
      repos = fs.readdirSync(directory, { withFileTypes: true })
        .filter(dir => dir.isDirectory())
        .map(dir => dir.name)
    }catch(err){
      logger.error("Failed to find the repo : ", err)
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

      info.stdout.on('data', function(data){
        data = Exec.maskGitToken(data)
        output.push(data)
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
      logger.notice(`Creating repository : ${Exec.maskGitToken((uri)?uri:command)}`)
      var directory = config.repoPath
      try{
        fs.accessSync(directory)
      }catch(e){
        try{
          logger.notice("Force creating path : " + directory)
          fs.mkdirSync(directory, { recursive: true,force:true });
        }catch(err){
          logger.error("Failed to create the path : ", err)
          reject(err)
          return;
        }
      }

      var cmd,parameters
      if(uri){
        cmd = `git clone --verbose ${uri}`
      }else if(command){
        cmd = command
      }else{
        reject("No uri or command given")
        return;
      }
      if(!cmd.startsWith('git clone')){
        reject("Not a git clone command")
        return;
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
      Exec.executeSilentCommand({command:cmd,directory:config.repoPath,description:"Cloning repository"})
      .then((out)=>{
        resolve(out)
      }).catch((e)=>{
        reject(e)
      })
      
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

// run a playbook
Repo.pull = function (repo) {

    var command = "git pull --verbose"
    var directory = path.join(config.repoPath,repo)
    return Exec.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"})

};
module.exports= Repo;
