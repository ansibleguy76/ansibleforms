'use strict';
import appConfig from '../../../config/app.config.js';
import multer from 'multer';
import logger from '../../lib/logger.js';
import RestResult from '../../models/restResult.model.js';
import fs from 'fs';


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(appConfig.uploadPath, { recursive: true })
    cb(null, appConfig.uploadPath)
  }
})

// File size cap. Default 10 GB (configurable via UPLOAD_MAX_GB).
// Set UPLOAD_MAX_GB=0 to disable the cap.
const _uploadMaxGb = appConfig.uploadMaxGb;
const _multerLimits = (_uploadMaxGb && _uploadMaxGb > 0)
  ? { fileSize: _uploadMaxGb * 1024 * 1024 * 1024 }
  : undefined;
const uploadMulter = multer({ storage: storage, limits: _multerLimits });
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
}
