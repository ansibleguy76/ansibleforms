'use strict';
import appConfig from '../../config/app.config.js';
import multer from 'multer';
import logger from '../lib/logger.js';
import RestResult from '../models/restResult.model.js';
import fs from 'fs';


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(appConfig.uploadPath, { recursive: true })
    cb(null, appConfig.uploadPath)
  }
})

const uploadMulter = multer({ storage: storage });
const upload = function(req, res,next) {
  const result = uploadMulter.single('file')

  result(req, res, function (err) {
      if(err) {
          logger.error(`Upload error : ${err.toString()}`)
          return res.send(new RestResult("error","file upload failed",null,err.toString()))
      } 
      logger.info(`Uploaded file ${req.file.originalname} as ${req.file.path}`)
      return res.json(new RestResult("success","file uploaded",req.file,""))
  })    
};

export default {
  upload
};
      



