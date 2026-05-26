'use strict';
import Expression from '../../models/expression.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import i18n from '../../lib/i18n.js';
import logger from '../../lib/logger.js';

const execute = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error(i18n.t(req, 'errors.noDataSent')));
    }else{
        // get the form data
        var expression = req.body.expression;
        var noLog = (req.query.noLog == "true");

        try {
          const result = await Expression.execute(expression,noLog)
          if(!noLog){
            try{
              logger.debug(`expression result : ${JSON.stringify(result)}`)
            }catch(e){
              //
            }
          }
          res.json(RestResult.single(result))
        } catch(err) {
          logger.error(`Error in expression : ${err}`)
          res.status(500).json(RestResult.error(err.toString()))
        }
    }
};

export default {
  execute
}