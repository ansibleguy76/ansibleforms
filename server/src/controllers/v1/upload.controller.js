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
//
// The limit is read per upload rather than captured at import, so changing UPLOAD_MAX_GB
// applies without a restart. multer() is a thin wrapper over its options object, so building
// it here costs nothing measurable beside the transfer it is about to handle.
const upload = function(req, res,_next) {
  const gb = appConfig.uploadMaxGb;
  const limits = (gb && gb > 0) ? { fileSize: gb * 1024 * 1024 * 1024 } : undefined;
  const result = multer({ storage: storage, limits }).single('file')

  result(req, res, function (err) {
      if(err) {
          logger.error(`Upload error : ${err.toString()}`)
          return res.send(new RestResult("error","file upload failed",null,err.toString()))
      } 
      logger.info(`Uploaded file ${String(req.file.originalname).replace(/[\r\n]+/g,' ')} as ${req.file.path}`)
      return res.json(new RestResult("success","file uploaded",req.file,""))
  })    
};

export default {
  upload
}
