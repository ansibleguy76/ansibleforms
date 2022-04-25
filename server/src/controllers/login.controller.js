'use strict';
const User = require("../models/user.model")
const passport = require('passport');
const jwt = require('jsonwebtoken');
var authConfig = require('../../config/auth.config')
const logger=require("../lib/logger");

exports.login = async function(req, res,next) {

    // as login, we authenticate against our passport basic (username and password are extracted by passport)
    // in auth.js the user is search locally or in ldap and eventually returns either an error or the user
    passport.authenticate(
      'basic',
      async (err, user) => {
        try {
          // if we have an error; we return it
          if (err || !user) {
            var error={token:""}
            if(err){
              logger.info(err)
              error.message=err
            }
            return res.json(error);
          }
          // we found a user (local or ldap) with correct password; we start the login process (a function attached by passport !)
          // http://www.passportjs.org/docs/login/
          req.login(
            user,
            { session: false },
            async (error) => {
              if (error){
                logger.error(error)
                return next(error);
              }

              logger.info(JSON.stringify(user))
              // is something like
              // {"username":"administrator","type":"local","roles":["public","admin"]}

              // we create 2 jwt tokens (accesstoken and refresh token)
              const token = jwt.sign({user}, authConfig.secret,{ expiresIn: authConfig.jwtExpiration});
              const refreshtoken = jwt.sign({user}, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration});

              // we store the tokens in the database, to later verify a refresh token action
              logger.info("Storing refreshtoken in database for user " + user.username)
              User.storeToken(user.username,user.type,refreshtoken,function(err,result){
                if(err){
                  logger.error(err)
                }else{
                  logger.info(result)
                }
              })
              // send the tokens to the requester
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
