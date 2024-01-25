// vue.config.js

/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
 const configureAPI = require('./../server/src/configure')
 const appConfig = require('./../server/config/app.config')

 module.exports = {
   devServer: {
     before: configureAPI,
     port: 8443,
     https: true
   },
   publicPath:appConfig.baseUrl // this is where we pass the BASE URL node env var to vue
 }
