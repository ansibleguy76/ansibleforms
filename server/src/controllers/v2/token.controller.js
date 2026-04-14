'use strict';
import RestResult from '../../models/restResult.model.v2.js';
import jwt from "jsonwebtoken";
import authConfig from '../../../config/auth.config.js';
import logger from "../../lib/logger.js";
import Token from "../../models/token.model.js";
import Errors from '../../lib/errors.js';

const refresh = async function(req, res) {
    try {
        // get the refresh token
        const refreshtoken = req.body.refreshtoken;
        logger.info("requesting refresh token");
        
        if(!refreshtoken){
            logger.error("no refresh token is provided");
            return res.status(400).json(RestResult.error('Please provide a refresh token'));
        }
        
        const jwtPayload = jwt.decode(refreshtoken);
        
        if(!jwtPayload || !jwtPayload.user || !jwtPayload.refresh){
            logger.error("Invalid refresh token");
            return res.status(401).json(RestResult.error('Invalid refresh token'));
        }
        
        const username = jwtPayload.user.username;
        const username_type = jwtPayload.user.type;
        
        const result = await Token.check(username, username_type, refreshtoken);
        
        if(new Date(jwtPayload.exp*1000) <= new Date()){
            logger.error("Refresh token is expired");
            await Token.delete(username, username_type, refreshtoken);
            logger.info("Removed token for " + username);
            return res.status(401).json(RestResult.error('Refresh token is expired'));
        }
        
        const body = jwtPayload.user;
        const token = jwt.sign({ user: body, access:true }, authConfig.secret, { expiresIn: authConfig.jwtExpiration, issuer: authConfig.jwtIssuer });
        const newRefreshtoken = jwt.sign({ user: body, refresh:true }, authConfig.secret, { expiresIn: authConfig.jwtRefreshExpiration, issuer: authConfig.jwtIssuer });
        
        await Token.store(username, username_type, newRefreshtoken);
        logger.info("Token is renewed and stored");
        
        res.json(RestResult.success('Token refreshed', { token, refreshtoken: newRefreshtoken }));
        
    } catch(err) {
        logger.error("Error : ", err);
        res.status(401).json(RestResult.error('Refresh token is unknown'));
    }
};

export default {
  refresh
}
