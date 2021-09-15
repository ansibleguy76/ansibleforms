
    // export default functions that are handy and usable with the javascrip expression field
    // expand if you need, you will to do a rebuild
const axios=require("axios")
const fs = require("fs")
const logger=require("../lib/logger");
const jq=require("node-jq")
exports.fnSum = function(a,b) { return a+b };
exports.fnMultiply = function(a,b) { return a*b };
exports.fnSampleRest1 = async function() {
  const data = await axios.get('https://jsonplaceholder.typicode.com/todos/1');
  return data.data
};
exports.fnSampleRest2 = async function() {
  var response=[]
  for(let i=0;i<20;i++){
    const data = await axios.get('https://jsonplaceholder.typicode.com/todos/1');
    response.push(data.data)
  }

  return response;
};
exports.fnReadJsonFile = function(path) {
  let result=[]
  try{
    let rawdata = fs.readFileSync(path);
    result = JSON.parse(rawdata);
  }catch(e){
    logger.error("Error in fnReadJsonFile : " + e)
  }
  return result
};
exports.fnJqRun = async function(path,filter,options) {
  try{
    return await jq.run(filter,path,options);
  }catch(e){
    logger.error("Error in fnReadJsonFile : " + e)
    return {}
  }

};

// etc
