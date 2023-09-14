// check.controller.js
const CheckModel = require('../models/install.model');
var RestResult = require('../models/restResult.model');

exports.performChecks = async function (req, res) {
    try {
      const summary = await CheckModel.performChecks();
  
      // Determine overall status based on the summary
      const overallStatus = Object.values(summary).every(checkStatus => checkStatus === 'OK')
        ? 'success'
        : 'failed';
  
      const message = overallStatus === 'success'
        ? 'All checks passed'
        : 'Some checks failed';
  
      res.json(new RestResult(overallStatus, message, summary, ''));
    } catch (error) {
      // Handle unexpected errors here
      res.json(new RestResult('error', 'Checks failed', null, error));
    }
  };