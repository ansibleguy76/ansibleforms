'use strict';
import fs from "fs";
import config from "../../config/log.config.js";
import path from "path";
import readLastLines from "read-last-lines";
import moment from "moment";

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

export default Log;
