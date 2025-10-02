'use strict';
import RestResult from '../models/restResult.model.js';
import jwt from "jsonwebtoken";
import authConfig from '../../config/auth.config.js';
import logger from "../lib/logger.js";
import User from "../models/user.model.js";

const refresh = function(req, res) {

    // get the refresh token
    var refreshtoken = req.body.refreshtoken
    logger.info("requesting refresh token")
    //handles null error
    if(!refreshtoken){
        logger.error("no refresh token is provided")
        res.status(400).send({ error:true, message: 'Please provide a refresh token' });
    }else{
        var jwtPayload=jwt.decode(refreshtoken)
        if(jwtPayload && jwtPayload.user && jwtPayload.refresh){
          var username=jwtPayload.user.username
          var username_type=jwtPayload.user.type
          User.checkToken(username,username_type,refreshtoken)
            .then((result)=>{
              var body = jwtPayload.user
              if(new Date(jwtPayload.exp*1000)>new Date()){
                // logger.info("refresh token is not expired")
                const token = jwt.sign({ user: body,access:true }, authConfig.secret,{ expiresIn: authConfig.jwtExpiration, issuer: authConfig.jwtIssuer});
                const refreshtoken = jwt.sign({ user: body,refresh:true }, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration, issuer: authConfig.jwtIssuer});
                User.storeToken(username,username_type,refreshtoken)
                  .then(()=>{
                    logger.info("Token is renewed and stored")
                    res.json({ token,refreshtoken });
                  })
                  .catch((err)=>{
                    logger.error("Failed to store new token")
                  })
              }else{
                logger.error("Refresh token is expired")
                User.deleteToken(username,username_type,refreshtoken)
                  .then(()=>{ logger.info("Removed token for " + username)} )
                  .catch((err)=>{ logger.error("Failed to remove token for " + username) })
                res.status(401).send({ error:true, message: 'Refresh token is expired' });
              }
            })
            .catch((err)=>{
              logger.error("Error : ", err)
              res.status(401).send({ error:true, message: 'Refresh token is unknown' });
            })
        }else{
          logger.error("Invalid refresh token")
          res.status(401).send({ error:true, message: 'Invalid refresh token' });
        }
    }
};

export default {
  refresh
}