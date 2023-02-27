'use strict';
const exec = require('child_process').exec;
const logger=require("../lib/logger")
const fs=require("fs")
const {inspect} = require("node:util")

const KnownHosts={

}

function escapeRegExp(string) {
  return string.replace(/[.*?^${}()/|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
KnownHosts.findAll = function () {
  return new Promise((resolve,reject)=>{
    var known_hosts
    var hosts
    const homedir = require('os').homedir();
    try{
      known_hosts=fs.readFileSync(`${homedir}/.ssh/known_hosts`)
      hosts=known_hosts.toString().split((/\r?\n/))
    }catch(e){
        logger.error(inspect(e))
        reject(e)
        return;
    }
    return resolve(hosts)
  })
}
KnownHosts.remove = function (host) {
  return new Promise((resolve,reject)=>{
    try{
      if(!host){
        reject("No host given")
        return;
      }else{
        logger.notice(`Removing host ${host}`)
        var escaped = escapeRegExp(host)
        const homedir = require('os').homedir();
        var cmd = `sed --in-place '/${escaped}/d' ${homedir}/.ssh/known_hosts`
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
            resolve(`Removing host ran succesfully\n${output.join("\n")}`)
            return;
          }else{
            reject(`\nRemoving host failed with code ${code}\n${output.join("\n")}`)
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
// add ssh known hosts
KnownHosts.add = function (host) {
  return new Promise((resolve,reject)=>{
    try{
      if(!host){
        reject("No host given")
        return;
      }else{
        logger.notice(`Adding keys for host ${host}`)
        var cmd = `ssh-keyscan ${host} >> ~/.ssh/known_hosts`
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

module.exports= KnownHosts;
