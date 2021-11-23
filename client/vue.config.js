// vue.config.js

/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
 const configureAPI = require('./../server/src/configure')
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')
 module.exports = {
   devServer: {
     before: configureAPI
   }
 }
