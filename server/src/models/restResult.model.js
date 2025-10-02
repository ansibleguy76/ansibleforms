'use strict';

//awx object create - not used, but you could create an instance with it
var RestResult=function(status,message,output,error,forExpression=false){
    if(!output && !forExpression){
      if(output!==undefined) output=""
    }
    if(!error){
      error=""
    }
    this.status = status
    this.message = message
    this.data = {
      output : output,
      error : error
    }
};
export default  RestResult;
