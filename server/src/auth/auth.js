const passport = require('passport');
const basicStrategy = require('passport-http').BasicStrategy;
const User = require('./../models/user.model');
const authConfig = require('../../config/auth.config.js')
const logger=require("../lib/logger");

// create username / password login strategy
passport.use(
  'basic',
  new basicStrategy(
    async (username, password, done) => {
      // authentication against database first
      try{
        var user = await User.authenticate(username,password)
          .catch((err)=>{
            logger.info(err)
            // move to next
            return Promise.resolve(null)
          })
          .then((result)=>{
            var user = {}
            if(result===null){
              // no local result
              // trying against ldap
              logger.info("No login locally, trying ldap")
              return User.checkLdap(username,password)
                .then((result)=>{
                  // valid local authentication
                  logger.info(JSON.stringify(result))
                  user.username = result.sAMAccountName
                  user.type = 'ldap'
                  user.roles = User.getRoles(user,result)
                  logger.info("ldap login is ok => " + user.username)
                  return user
                })
            }
            // user found in db
            if(!result.isValid)throw "Wrong password"
            user.username = result.user.username
            user.id = result.user.id
            user.type = 'local'
            user.roles = User.getRoles(user,result.user.groups)
            logger.info("local login is ok => " + user.username)
            return user
          })
          .catch((err)=>{
            const match = err.match(authConfig.ldapErrorRegex)
            if(match){
              try{
                var errMessage=authConfig.ldapErrors[match[1]]
              }catch(e){
                throw "Error " + match[1]
              }
              throw errMessage
            }
            throw err
          })
        // we have an authenticated user
        return done(null,user)
      }catch(err){
        return done(err)
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
