import RestResult from "../models/restResult.model.v2.js";
import i18n from "./i18n.js";

var Middleware = function(){

}

// Build a route guard for a single permission.
//
// The status code matters more than it looks : the client has ONE global axios
// interceptor for 401 (App.vue), which means "your token is no good" - it clears
// the token storage and bounces you to the login page. A permission failure is
// not that. The user IS authenticated, they simply may not have this endpoint,
// and a page that calls it opportunistically (the designer probing settings, an
// admin table loading its lookups) must be able to catch the error and carry on.
// Answering 401 there logged the user straight out instead, and in a non-english
// locale - where the message no longer matched the interceptor's english test -
// it fell through to the refresh branch, refreshed successfully (the token was
// always valid), retried, got 401 again, and looped.
//
// So : 403 when we know who you are and you may not do this, 401 only when we
// could not establish who you are at all (req.user missing or malformed, which
// authobj should already have rejected - this is the defensive path).
function permissionGuard(hasPermission, detailKey){
  return (req, res, next) => {
    try {
      if (!hasPermission(req.user.user)) {
        res.status(403).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, detailKey)));
      } else {
        next();
      }
    } catch (e) {
      res.status(401).json(RestResult.error(i18n.t(req, 'errors.noAccess'), i18n.t(req, detailKey)));
    }
  }
}

// a middleware in the routes to check if use is administrator
Middleware.checkAdminMiddleware = permissionGuard(u => u.roles.includes("admin"), 'errors.notAdmin')

Middleware.checkSettingsMiddleware = permissionGuard(u => u.options.showSettings, 'errors.noSettingsAccess')

Middleware.checkDesignerMiddleware = permissionGuard(u => u.options.showDesigner, 'errors.noDesignerAccess')

Middleware.checkLogsMiddleware = permissionGuard(u => u.options.showLogs, 'errors.noLogsAccess')

Middleware.checkBackupMiddleware = permissionGuard(u => u.options.allowBackupOps, 'errors.noDatabaseAccess')

Middleware.checkScheduledJobsMiddleware = permissionGuard(u => u.options.allowScheduledJobs, 'errors.noScheduleAccess')

Middleware.checkStoredJobsMiddleware = permissionGuard(u => u.options.allowStoredJobs, 'errors.noStoredJobsAccess')

// The schedules page is gated on allowScheduledJobs rather than showSettings, but
// its form dropdown reads config/formnames - a list that is deliberately NOT role
// filtered (unlike config/formlist), so it has to stay behind a permission.
// Either administrative right is enough to see it.
Middleware.checkSettingsOrScheduledJobsMiddleware = permissionGuard(
  u => u.options.showSettings || u.options.allowScheduledJobs, 'errors.noSettingsAccess')

export default Middleware
