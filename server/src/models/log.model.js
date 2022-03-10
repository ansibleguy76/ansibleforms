'use strict';
const fs=require("fs")
const config=require("../../config/log.config")
const path=require("path")
const readLastLines=require("read-last-lines")

const Log = {

}

Log.find = function (lines,result) {
  const fileName = path.join(config.path,'ansibleforms.log')
  readLastLines.read(fileName, lines)
  	.then((lines) => result(null,lines))
    .catch(() => result(true));
};

module.exports= Log;
