'use strict';
import Expression from '../../models/expression.model.js';
import RestResult from '../../models/restResult.model.js';
import logger from '../../lib/logger.js';

const execute = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var expression = req.body.expression;
        var noLog = (req.query.noLog == "true");

        Expression.execute(expression,noLog)
          .then((result)=>{
            if(!noLog){
              try{
                logger.debug(`expression result : ${JSON.stringify(result)}`)
              }catch(e){
                //
              }
            }
            res.json(new RestResult("success","successfully executed expression " + expression,result,undefined,true))
          })
          .catch((err)=>{
            logger.error(`Error in expression : ${err}`)
            // "error", not "success" - see the job controller ; the message already said
            // "failed" while the status field said the opposite
            res.status(500).json(new RestResult("error","failed to execute expression " + expression,undefined,err.toString()))
          })
    }
};

export default {
  execute
}