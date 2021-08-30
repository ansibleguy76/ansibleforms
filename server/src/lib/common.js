var Helpers = function(){

}

Helpers.nocache= function(module) {require("fs").watchFile(require("path").resolve(module), () => {delete require.cache[require.resolve(module)]})}

module.exports = Helpers
