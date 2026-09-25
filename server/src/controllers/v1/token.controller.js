'use strict';
import jwt from "jsonwebtoken";
import authConfig from '../../../config/auth.config.js';
import logger from "../../lib/logger.js";
import Token from "../../models/token.model.js";
import User from "../../models/user.model.js";

const refresh = function(req, res) {

    // get the refresh token
    var refreshtoken = req.body.refreshtoken
    logger.info("requesting refresh token")
    //handles null error
    if(!refreshtoken){
        logger.error("no refresh token is provided")
        res.status(400).send({ error:true, message: 'Please provide a refresh token' });
    }else{
        // VERIFY, not decode - see the v2 controller for why. Both endpoints are mounted.
        var jwtPayload=null
        try{
          jwtPayload = jwt.verify(refreshtoken, authConfig.secret, { issuer: authConfig.jwtIssuer })
        }catch(e){
          logger.error(`Refresh token rejected : ${e.message}`)
        }
        if(jwtPayload && jwtPayload.user && jwtPayload.refresh){
          var username=jwtPayload.user.username
          var username_type=jwtPayload.user.type
          Token.check(username,username_type,refreshtoken)
            .then(async ()=>{
              // re-resolve rather than copying the roles frozen at login, so removing a
              // role or a group membership actually takes effect
              var body = { ...jwtPayload.user }
              try{
                const ro = await User.getRolesAndOptions(body.groups || [], body)
                body.roles = ro.roles
                body.options = ro.options
              }catch(e){
                logger.error(`Could not re-resolve roles on refresh for ${username} : ${e.message}`)
                return res.status(401).send({ error:true, message: 'Refresh token is unknown' })
              }
              if(new Date(jwtPayload.exp*1000)>new Date()){
                // logger.info("refresh token is not expired")
                const token = jwt.sign({ user: body,access:true }, authConfig.secret,{ expiresIn: authConfig.jwtExpiration, issuer: authConfig.jwtIssuer});
                const refreshtoken = jwt.sign({ user: body,refresh:true }, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration, issuer: authConfig.jwtIssuer});
                Token.store(username,username_type,refreshtoken)
                  .then(async ()=>{
                    // single use : the old row used to stay valid alongside the new one
                    await Token.delete(username,username_type,req.body.refreshtoken).catch(()=>{})
                    logger.info("Token is renewed and stored")
                    res.json({ token,refreshtoken });
                  })
                  .catch(()=>{
                    logger.error("Failed to store new token")
                  })
              }else{
                logger.error("Refresh token is expired")
                Token.delete(username,username_type,refreshtoken)
                  .then(()=>{ logger.info("Removed token for " + username)} )
                  .catch(()=>{ logger.error("Failed to remove token for " + username) })
                res.status(401).send({ error:true, message: 'Refresh token is expired' });
              }
            })
            .catch((err)=>{
              logger.error(`Error : ${err.toString()}`)
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
