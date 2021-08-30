'use strict';
const jwt = require("jsonwebtoken")
var authConfig = require('../../config/auth.config.js')
const logger=require("../lib/logger");

exports.refresh = function(req, res) {
    var refreshtoken = req.body.refreshtoken
    logger.debug("requesting access token")
    //handles null error
    if(!refreshtoken){
        logger.error("no refresh token is provided")
        res.status(400).send({ error:true, message: 'Please provide a refresh token' });
    }else{
        var jwtPayload=jwt.decode(refreshtoken)
        if(jwtPayload.user){
          var username=jwtPayload.user.username
          if(authConfig.jwtStore[refreshtoken]==username){
            // logger.debug("refresh token is valid " + refreshtoken + " - " + authConfig.jwtStore[refreshtoken])
            logger.debug("removing refreshtoken")
            delete authConfig.jwtStore[refreshtoken]
            var body = jwtPayload.user
            if(new Date(jwtPayload.exp*1000)>new Date()){
              // logger.debug("refresh token is not expired")
              const token = jwt.sign({ user: body }, authConfig.secret,{ expiresIn: authConfig.jwtExpiration});
              const refreshtoken = jwt.sign({ user: body }, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration});
              logger.debug("storing new refreshtoken")
              authConfig.jwtStore[refreshtoken]=username
              res.json({ token,refreshtoken });
            }else{
              logger.error("Refresh token is expired")
              res.status(400).send({ error:true, message: 'Refresh token is expired' });
            }
          }else{
            logger.error("Unknown refreshtoken")
            res.status(400).send({ error:true, message: 'Refresh token is unknown' });
          }

        }else{
          logger.error("Invalid refresh token")
          res.status(401).send({ error:true, message: 'Invalid refresh token' });
        }

    }
};
