const passport = require('passport');
const authConfig = require('../../config/auth.config.js')
const logger=require("../lib/logger");
const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;

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
