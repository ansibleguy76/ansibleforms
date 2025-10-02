// check.controller.js
import CheckModel from "../models/install.model.js";
import RestResult from "../models/restResult.model.js";

const performChecks = async function (req, res) {
  try {
    const summary = await CheckModel.performChecks();

    // Determine overall status based on the summary
    const overallStatus = Object.values(summary).every((checkStatus) => checkStatus === "OK") ? "success" : "failed";

    const message = overallStatus === "success" ? "All checks passed" : "Some checks failed";

    res.json(new RestResult(overallStatus, message, summary, ""));
  } catch (err) {
    // Handle unexpected errors here
    res.json(new RestResult("error", "Checks failed", null, err.toString()));
  }
};

export default {
  performChecks
};