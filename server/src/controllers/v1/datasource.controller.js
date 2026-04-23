"use strict";
import Ds from "../../models/datasource.model.js";
import RestResult from "../../models/restResult.model.js";
import cronService from "../../services/cron.service.js";
import logger from "../../lib/logger.js";

const findAllOr1 = async function(req, res) {
  if(req.query.name){
    try {
      const datasource = await Ds.findByName(req.query.name);
      res.json(new RestResult("success", "datasource found", datasource, ""));
    } catch (err) {
      res.json(new RestResult("error", "failed to find datasource", null, err.toString()));
    }
  }else{
    try {
      const datasources = await Ds.findAll();
      res.json(new RestResult("success", "datasources found", datasources, ""));
    } catch (err) {
      res.json(new RestResult("error", "failed to find datasources", null, err.toString()));
    }
  }
};

const create = async function (req, res) {
  try {
    const new_datasource = new Ds(req.body);
    //handles null error

    if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
      res.status(400).send({ error: true, message: "Please provide all required fields" });
    } else {
      const insertId = await Ds.create(new_datasource);
      // Fetch the created record to get all fields for cron service
      const datasourceArray = await Ds.findById(insertId);
      const datasource = datasourceArray.length > 0 ? datasourceArray[0] : null;
      // Add to cron service if cron expression exists
      if(datasource && datasource.cron && datasource.cron.trim() !== '') {
        logger.info(`Adding datasource '${datasource.name}' (ID: ${datasource.id}) to cron service with schedule: ${datasource.cron}`);
        cronService.addDatasource(datasource.id, datasource.name, datasource.cron);
      }
      res.json(new RestResult("success", "datasource added", datasource, ""));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to create datasource", null, err.toString()));
  }
};
const findById = async function (req, res) {
  try {
    const datasource = await Ds.findById(req.params.id);
    if (datasource.length > 0) {
      res.json(new RestResult("success", "found datasource", datasource[0], ""));
    } else {
      res.json(new RestResult("error", "failed to find datasource", null, err.toString()));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to find datasource", null, err.toString()));
  }
};
const update = async function (req, res) {
  try {
    delete req.body.datasourcename;
    if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
      res.status(400).send({ error: true, message: "Please provide all required fields" });
    } else {
      await Ds.update(new Ds(req.body), req.params.id);
      // Fetch the updated record to get all fields for cron service
      const updatedDs = await Ds.findById(req.params.id);
      if(updatedDs && updatedDs.length > 0) {
        const ds = updatedDs[0];
        // Update cron service with complete record
        if(ds.cron && ds.cron.trim() !== '') {
          logger.info(`Updating datasource '${ds.name}' (ID: ${ds.id}) in cron service with schedule: ${ds.cron}`);
          cronService.addDatasource(ds.id, ds.name, ds.cron);
        } else {
          logger.info(`Removing datasource '${ds.name}' (ID: ${ds.id}) from cron service (no schedule)`);
          cronService.removeDatasource(ds.id);
        }
      }
      res.json(new RestResult("success", "datasource updated", null, ""));
    }
  } catch (err) {
    res.json(new RestResult("error", "failed to update datasource", null, err.toString()));
  }
};
const deleteDatasource = async function (req, res) {
  try {
    await Ds.delete(req.params.id);
    // Remove from cron service
    logger.info(`Removing datasource ID ${req.params.id} from cron service`);
    cronService.removeDatasource(req.params.id);
    res.json(new RestResult("success", "datasource deleted", null, ""));
  } catch (err) {
    res.json(new RestResult("error", "failed to delete datasource", null, err.toString()));
  }
};
const importDatasource = async function (req, res) {
  try {
    await Ds.queue(req.params.id);
    res.json(new RestResult("success", "datasource imported", null, ""));
  } catch (err) {
    res.json(new RestResult("error", "failed to import datasource", null, err.toString()));
  }
};

export default {
  findAllOr1,
  create,
  findById,
  update,
  "delete": deleteDatasource,
  "import": importDatasource
};