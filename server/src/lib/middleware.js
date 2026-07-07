import RestResult from "../models/restResult.model.v2.js";
import i18n from "./i18n.js";

var Middleware = function(){

}

// a middleware in the routes to check if use is administrator
Middleware.checkAdminMiddleware = (req, res, next) =>  {
  try{
    if(!req.user.user.roles.includes("admin")) {
      res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.notAdmin')))
    } else {
      next()
    }
  }catch(e){
    res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.notAdmin')))
  }
}
Middleware.checkSettingsMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.showSettings) {
      res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noSettingsAccess')));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noSettingsAccess')));
  }
}

Middleware.checkDesignerMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.showDesigner) {
      res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noDesignerAccess')));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noDesignerAccess')));
  }
}

Middleware.checkLogsMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.showLogs) {
      res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noLogsAccess')));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noLogsAccess')));
  }
}

Middleware.checkBackupMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.allowBackupOps) {
      res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noDatabaseAccess')));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noDatabaseAccess')));
  }
}

Middleware.checkScheduledJobsMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.allowScheduledJobs) {
      res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noScheduleAccess')));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noScheduleAccess')));
  }
}

Middleware.checkStoredJobsMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.allowStoredJobs) {
      res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noStoredJobsAccess')));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, 'errors.noStoredJobsAccess')));
  }
}

export default Middleware
