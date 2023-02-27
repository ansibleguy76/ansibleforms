// vue.config.js

/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
 const configureAPI = require('./../server/src/configure')

 module.exports = {
   devServer: {
     before: configureAPI,
     port: 8443,
     https: true
   }
 }
