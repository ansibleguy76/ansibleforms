const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const UserModel = require('./../models/user.model');
const authConfig = require('../../config/auth.config.js')
const logger=require("../lib/logger");

var config="AUTH"
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
        UserModel.authenticate(username,password,config,function(err,result){

          if (err || result===null) {
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
            return done(null, false, { message: 'Wrong Password'});
          }else{
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
const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;

passport.use(
  new JWTstrategy(
    {
      secretOrKey: authConfig.secret,
      // jwtFromRequest: ExtractJWT.fromUrlQueryParameter('secret_token')
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken()
    },
    async (token, done) => {
      try {
        return done(null, token);
      } catch (error) {
        logger.debug("error ?")
        done(error);
      }
    }
  )
);
