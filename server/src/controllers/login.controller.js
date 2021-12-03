'use strict';
var RestResult = require('../models/restResult.model');
const User = require("../models/user.model")
const passport = require('passport');
const jwt = require('jsonwebtoken');
var authConfig = require('../../config/auth.config')
const logger=require("../lib/logger");

exports.login = async function(req, res,next) {
    passport.authenticate(
      'basic',
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
              if (error){
                logger.error(error)
                return next(error);
              }
              logger.debug(JSON.stringify(user))

              const token = jwt.sign({user}, authConfig.secret,{ expiresIn: authConfig.jwtExpiration});
              const refreshtoken = jwt.sign({user}, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration});
              logger.debug("Storing refreshtoken in database for user " + user.username)
              User.storeToken(user.username,user.type,refreshtoken,function(err,result){
                if(err){
                  logger.error(err)
                }else{
                  logger.debug(result)
                }
              })
              authConfig.jwtStore[refreshtoken]=user.username
              return res.json({ token,refreshtoken });
            }
          );
        } catch (error) {
          logger.error(error)
          return next(error);
        }
      }
    )(req, res, next);
};
