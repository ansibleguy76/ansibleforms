'use strict';
const fs=require("fs")
const config=require("../../config/log.config")
const path=require("path")
const readLastLines=require("read-last-lines")
const moment=require("moment")

const Log = {

}

Log.find = function (lines) {
  const fileName = this.getFileName()
  return readLastLines.read(fileName, lines)  
};

Log.getFileName = function(){
  // return the latest log file name to download
  const today = moment().format("YYYY-MM-DD")
  const fileName = path.join(config.path,`ansibleforms.${today}.log`)
  if(fs.existsSync(fileName)){
    return fileName
  }else{
    throw new Error(`No logfile ansibleforms.${today}.log found`)
  }
}

module.exports= Log;
