const express = require('express')
const passport = require('passport');
const jwt = require('jsonwebtoken');
var authConfig = require('../../config/auth.config.js')
const logger=require("../lib/logger");
const router = express.Router()

router.post(
  '/login',
  async (req, res, next) => {
    passport.authenticate(
      'login',
      async (err, user, info) => {
        try {
          if (err || !user) {
            var error={token:""}
            if(err){
              logger.debug(err)
              error.message=err
            }else{
              logger.debug(info.message)
              error.message=info.message;
            }
            return res.json(error);
          }

          req.login(
            user,
            { session: false },
            async (error) => {
              if (error) return next(error);
              logger.debug(JSON.stringify(user))

              const token = jwt.sign({user}, authConfig.secret,{ expiresIn: authConfig.jwtExpiration});
              const refreshtoken = jwt.sign({user}, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration});
              logger.debug("Storing refreshtoken in memory for user " + user.username)
              authConfig.jwtStore[refreshtoken]=user.username
              return res.json({ token,refreshtoken });
            }
          );
        } catch (error) {
          return next(error);
        }
      }
    )(req, res, next);
  }
);
module.exports = router
