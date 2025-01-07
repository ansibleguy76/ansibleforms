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

Exec.executeSilentCommand = async (cmd,silent=false,singleLine=false) => {
  return new Promise((resolve,reject)=>{
    try{
      var command = cmd.command
      var directory = cmd.directory
      var description = cmd.description
      // execute the procces
      logger.debug(`${description}, ${directory} > ${Exec.maskGitToken(command)}`)
  
      var cmdlist = command.split(' ')
      var basecmd = cmdlist[0]
      var parameters = cmdlist.slice(1)
      var child = spawn(basecmd,parameters,{shell:true,stdio:["ignore","pipe","pipe"],cwd:directory,detached:true});
        var timeout = setTimeout(()=>{
          Exec.killChildren(child.pid)
        },60000)
        var out=[]
        if(!singleLine){
          out.push(`Running command : ${Exec.maskGitToken(command)}`)
        }
        if(!silent){
          logger.notice(`Running command : ${Exec.maskGitToken(command)}`)          
        }
        
        // add output eventlistener to the process to save output
        child.stdout.on('data',function(data){
          var txt=data.toString()
          txt = Exec.maskGitToken(txt)
          out.push(txt)
        })
        // add error eventlistener to the process to save output
        child.stderr.on('data',function(data){
          var txt=data.toString()
          txt = Exec.maskGitToken(txt)
          out.push(txt)
        })
        // add exit eventlistener to the process to handle status update
        child.on('exit',function(data){
          clearTimeout(timeout)
          logger.info(description + " finished : " + data)
          // always push something to
          out.push("")
          if(data!=0){
            if(child.signalCode=='SIGTERM'){
              out.push("The command timed out")
            }

            if(singleLine){
              reject(new Error(out[0]))
              return
            }else{
              reject(new Error(out.join("\r\n")))
              return
            }
          }
          if(singleLine){
            resolve(out[0])
            return
          }else{
            resolve(out.join('\r\n'))
            return 
          }

        })
        // add error eventlistener to the process; set failed
        child.on('error',function(data){
          var txt=data.toString()
          txt = Exec.maskGitToken(txt)
          out.push(txt)
          reject(new Error(out.join('\n')))
          return
        })

    }catch(e){
      reject(e.message)
    }   
  })

}


const Repo={

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
    return await Exec.executeSilentCommand({command:cmd,directory:directory,description:"Getting repository info"},true,true)

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
      return await Exec.executeSilentCommand({command:cmd,directory:directory,description:"Cloning repository"})

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
      return await Exec.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"},true)
};
module.exports= Repo;
