'use strict';
const fs=require("fs")
const config=require("../../config/log.config")
const path=require("path")
const readLastLines=require("read-last-lines")

const Log = {

}

Log.find = function (lines) {
  const fileName = path.join(config.path,'ansibleforms.log')
  return readLastLines.read(fileName, lines)
};

module.exports= Log;
