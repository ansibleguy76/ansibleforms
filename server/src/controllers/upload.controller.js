'use strict';
const appConfig = require('../../config/app.config')
const multer = require('multer');
const logger=require("../lib/logger");
var RestResult = require('../models/restResult.model');

// const upload = multer({ dest: appConfig.uploadPath });
const fs = require('fs')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(appConfig.uploadPath, { recursive: true })
        cb(null, appConfig.uploadPath)
    }
})
const upload = multer({ storage: storage });

exports.upload = function(req, res,next) {
  const result = upload.single('file')

  result(req, res, function (err) {
      if(err) {
          logger.error(`Upload error : ${err.message}`)
          return res.send(new RestResult("error","file upload failed",null,err.message))
      } 
      logger.info(`Uploaded file ${req.file.originalname} as ${req.file.path}`)
      return res.json(new RestResult("success","file uploaded",req.file,""))
  })    
};
      



