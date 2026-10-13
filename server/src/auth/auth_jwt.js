import passport from 'passport';
import authConfig from '../../config/auth.config.js';
import logger from '../lib/logger.js';
import { Strategy as JWTstrategy, ExtractJwt as ExtractJWT } from 'passport-jwt';
import { isRevoked } from '../lib/tokenRevocation.js';
import { withGroups } from '../lib/userGroups.js';

passport.use(
  new JWTstrategy(
    {
      secretOrKey: authConfig.secret,
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken()
    },
    async (jwtPayload, done) => {
      try {
        if(jwtPayload.access){
          // its session logged out, or its user changed the password since it was issued
          if (await isRevoked(jwtPayload)) return done(null, false, { message: 'Token revoked' });
          // the token carries no groups (they made it too large for the request header, #1036) :
          // they are put back here from where the sign-in stored them, so every reader of
          // req.user.user.groups sees them as before (lib/userGroups.js). A token issued
          // before keeps the groups it carries.
          return done(null, { ...jwtPayload, user: await withGroups(jwtPayload.user) });
        }else {
          done(null, false,{message:'Bad accesstoken'})
        }
      } catch (error) {
        logger.info("error ?")
        done(error,false,{message:'Unknown JWT error'});
      }
    }
  )
);
