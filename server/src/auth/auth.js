const passport = require('passport');
const basicStrategy = require('passport-http').BasicStrategy;
const UserModel = require('./../models/user.model');
const authConfig = require('../../config/auth.config.js')
const logger=require("../lib/logger");

// create username / password login strategy
passport.use(
  'basic',
  new basicStrategy(
    async (username, password, done) => {
      try {
        var user = {}
        // authentication against database first
        UserModel.authenticate(username,password,function(err,result){
          // if error ?
          if (err || result===null) {
            // trying against ldap
            logger.debug("No login locally, trying ldap")
            UserModel.checkLdap(username,password,function(err,result){
              if(err){
                const match = err.match(authConfig.ldapErrorRegex)
                if(match){
                  try{
                    var errMessage=authConfig.ldapErrors[match[1]]
                    return done(errMessage)
                  }catch(e){
                    return done("Error " + match[1])
                  }
                }else{
                  return done(err)
                }
              }else{
                logger.debug(JSON.stringify(result))
                user.username = result.sAMAccountName
                user.type = 'ldap'
                user.roles = UserModel.getRoles(user,result)
                logger.debug("ldap login is ok => " + user.username)
                return done(null, user);
              }

            });

          }else if(!result.isValid) {
            // user found in db, but wrong pw
            return done("Wrong password")
            //return done(null, false, { message: 'Wrong Password'});
          }else{
            // user ok in db
            user.username = result.user.username
            user.id = result.user.id
            user.type = 'local'
            user.roles = UserModel.getRoles(user,result.user.groups)
            logger.debug("local login is ok => " + user.username)
            return done(null, user);
          }
        });
      } catch (error) {
        return done(error);
      }
    }
  )
);
// add strategy for token
const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;
passport.use(
  new JWTstrategy(
    {
      secretOrKey: authConfig.secret,
      // jwtFromRequest: ExtractJWT.fromUrlQueryParameter('secret_token')
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken()
    },
    async (jwtPayload, done) => {
      try {
        return done(null, jwtPayload);
      } catch (error) {
        logger.debug("error ?")
        done(error);
      }
    }
  )
);
