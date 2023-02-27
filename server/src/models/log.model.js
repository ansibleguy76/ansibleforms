'use strict';
const fs=require("fs")
const config=require("../../config/log.config")
const path=require("path")
const readLastLines=require("read-last-lines")
const moment=require("moment")

const Log = {

}

Log.find = function (lines) {
  const today = moment().format("YYYY-MM-DD")
  const fileName = path.join(config.path,`ansibleforms.${today}.log`)
  if(fs.existsSync(fileName)){
    return readLastLines.read(fileName, lines)  
  }else{
    return [`No logfile ansibleforms.${today}.log found`]
  }
};

module.exports= Log;
