'use strict';
const RestResult = require('../models/restResult.model')
const jwt = require("jsonwebtoken")
var authConfig = require('../../config/auth.config')
const logger=require("../lib/logger");
const User=require("../models/user.model")

exports.refresh = function(req, res) {

    // get the refresh token
    var refreshtoken = req.body.refreshtoken
    logger.debug("requesting refresh token")
    //handles null error
    if(!refreshtoken){
        logger.error("no refresh token is provided")
        res.status(400).send({ error:true, message: 'Please provide a refresh token' });
    }else{
        var jwtPayload=jwt.decode(refreshtoken)
        if(jwtPayload && jwtPayload.user){
          var username=jwtPayload.user.username
          var username_type=jwtPayload.user.type
          User.checkToken(username,username_type,refreshtoken,function(err,result){
            if(err){
              logger.error(err)
              res.status(401).send({ error:true, message: 'Refresh token is unknown' });
            }else{
                var body = jwtPayload.user
                if(new Date(jwtPayload.exp*1000)>new Date()){
                  // logger.debug("refresh token is not expired")
                  const token = jwt.sign({ user: body }, authConfig.secret,{ expiresIn: authConfig.jwtExpiration});
                  const refreshtoken = jwt.sign({ user: body }, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration});
                  User.storeToken(username,username_type,refreshtoken,function(err,resnewtoken){
                    if(err){
                      logger.error("Failed to store new token")
                    }else{
                      logger.debug("Token is renewed and stored")
                      res.json({ token,refreshtoken });
                    }
                  })

                }else{
                  logger.error("Refresh token is expired")
                  res.status(401).send({ error:true, message: 'Refresh token is expired' });
                }
            }
          })
        }else{
          logger.error("Invalid refresh token")
          res.status(401).send({ error:true, message: 'Invalid refresh token' });
        }

    }
};
