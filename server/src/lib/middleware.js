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
    if (!(req.user.user.options?.showSettings ?? req.user.user.roles.includes("admin"))) {
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
    if (!(req.user.user.options?.showDesigner ?? req.user.user.roles.includes("admin"))) {
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
    if (!(req.user.user.options?.showLogs ?? req.user.user.roles.includes("admin"))) {
      res.status(401).json(new restResult("error", "No access",null,"You do not have access to logs"));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(new restResult("error", "No access",null,"You do not have access to logs"));
  }
}

Middleware.checkDatabaseMiddleware = (req, res, next) => {
  try {
    if (!(req.user.user.options?.allowDatabaseOps ?? req.user.user.roles.includes("admin"))) {
      res.status(401).json(new restResult("error", "No access", null, "You do not have access to database operations"));
    } else {
      next();
    }
  } catch (e) {
    res.status(401).json(new restResult("error", "No access", null, "You do not have access to database operations"));
  }
}

export default Middleware
