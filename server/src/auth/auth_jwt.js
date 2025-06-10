import passport from 'passport';
import authConfig from '../../config/auth.config.js';
import logger from '../lib/logger.js';
import { Strategy as JWTstrategy, ExtractJwt as ExtractJWT } from 'passport-jwt';

passport.use(
  new JWTstrategy(
    {
      secretOrKey: authConfig.secret,
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken()
    },
    async (jwtPayload, done) => {
      try {
        if(jwtPayload.access){
          return done(null, jwtPayload);
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
