'use strict';
const logger=require("../lib/logger");
const fsPromises=require("fs").promises
var config=require('../../config/app.config')
const YAML=require("yaml")

//lock object create
var Help=function(){

};

Help.get = function(help){
  return Help.read()
    .then((help)=>{
      return Promise.resolve(YAML.parse(help))
    })
    .catch((e)=>{
        return Promise.reject(e.toString())
    })
}

Help.read = function () {

    return fsPromises
      .readFile(config.helpPath,{encoding:"utf8"})
};

module.exports= Help;
