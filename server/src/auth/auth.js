const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const UserModel = require('./../models/user.model');
const authConfig = require('../../config/auth.config.js')
const logger=require("../lib/logger");

var config="AUTH"

// create username / password login strategy
passport.use(
  'login',
  new localStrategy(
    {
      usernameField: 'username',
      passwordField: 'password'
    },
    async (username, password, done) => {
      try {
        var user = {}
        // authentication against database first
        UserModel.authenticate(username,password,config,function(err,result){
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
                return done(null, user, { message: 'Logged in successfully with LDAP authentication'});
              }

            });

          }else if(!result.isValid) {
            // user found in db, but wrong pw
            return done(null, false, { message: 'Wrong Password'});
          }else{
            // user ok in db
            user.username = result.user.username
            user.type = 'local'
            user.roles = UserModel.getRoles(user,result.user.groups)
            return done(null, user, { message: 'Logged in successfully with local authentication'});
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
