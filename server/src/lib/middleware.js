import restResult from "../models/restResult.model.js";

var Middleware = function(){

}

// a middleware in the routes to check if use is administrator
Middleware.checkAdminMiddleware = (req, res, next) =>  {
  try{
    if(!req.user.user.roles.includes("admin")) {
      res.status(401).json(new restResult("error","No access",null,"You are not an admin"))
    } else {
      //logger.debug("You are admin, access to user management")
      next()
    }
  }catch(e){
    res.status(401).json(new restResult("error","No access",null,"You are not an admin"))
  }
}
Middleware.checkSettingsMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.showSettings) {
      res.status(401).json(new restResult("error", "No access",null,"You do not have access to settings"));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(new restResult("error", "No access",null,"You do not have access to settings"));
  }
}

Middleware.checkDesignerMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.showDesigner) {
      res.status(401).json(new restResult("error", "No access",null,"You do not have access to designer"));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(new restResult("error", "No access",null,"You do not have access to designer"));
  }
}

Middleware.checkLogsMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.showLogs) {
      res.status(401).json(new restResult("error", "No access",null,"You do not have access to logs"));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(new restResult("error", "No access",null,"You do not have access to logs"));
  }
}

Middleware.checkBackupMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.allowBackupOps) {
      res.status(401).json(new restResult("error", "No access", null, "You do not have access to database operations"));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(new restResult("error", "No access", null, "You do not have access to database operations"));
  }
}

Middleware.checkScheduledJobsMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.allowScheduledJobs) {
      res.status(401).json(new restResult("error", "No access", null, "You do not have permission to manage scheduled jobs"));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(new restResult("error", "No access", null, "You do not have permission to manage scheduled jobs"));
  }
}

Middleware.checkStoredJobsMiddleware = (req, res, next) => {
  try {
    if (!req.user.user.options.allowStoredJobs) {
      res.status(401).json(new restResult("error", "No access", null, "You do not have permission to manage stored jobs"));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(new restResult("error", "No access", null, "You do not have permission to manage stored jobs"));
  }
}

export default Middleware
