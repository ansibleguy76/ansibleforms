'use strict';
import Repository from '../../models/repository.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import cronService from '../../services/cron.service.js';
import logger from '../../lib/logger.js';

const find = async function(req, res) {
  try {
    const repositories = await Repository.findAll();
    res.json(RestResult.list(repositories));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to find repositories", err.toString()));
  }
};

const create = async function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0) {
    return res.status(400).json(RestResult.error("Please provide all required fields"));
  }
  try {
    const insertId = await Repository.create(req.body);
    // Fetch the created record to get all fields including cron
    const created = await Repository.findByName(req.body.name);
    // Add to cron service if cron expression exists
    if(created.cron && created.cron.trim() !== '') {
      logger.info(`Adding repository '${created.name}' to cron service with schedule: ${created.cron}`);
      cronService.addRepository(created.name, created.cron);
    }
    res.json(RestResult.single({ id: insertId }));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to create repository", err.toString()));
  }
};

const findByName = async function(req, res) {
  try {
    const repository = await Repository.findByName(req.params.name);
    repository.password = "**********"; // mask the password for api
    res.json(RestResult.single(repository));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to find repository", err.toString()));
  }
};

const update = async function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0) {
    return res.status(400).json(RestResult.error("Please provide all required fields"));
  }
  try {
    await Repository.update(req.body, req.params.name);
    // Fetch the updated record to get the cron field
    const updated = await Repository.findByName(req.params.name);
    // Update cron service with complete record
    if(updated.cron) {
      logger.info(`Updating repository '${updated.name}' in cron service with schedule: ${updated.cron}`);
      cronService.addRepository(updated.name, updated.cron);
    } else {
      logger.info(`Removing repository '${updated.name}' from cron service (no schedule)`);
      cronService.removeRepository(updated.name);
    }
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to update repository", err.toString()));
  }
};

const deleteRepository = async function(req, res) {
  try {
    await Repository.delete(req.params.name);
    // Remove from cron service
    logger.info(`Removing repository '${req.params.name}' from cron service`);
    cronService.removeRepository(req.params.name);
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to delete repository", err.toString()));
  }
};

const clone = async function(req, res) {
  try {
    await Repository.clone(req.params.name);
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to clone repository", err.toString()));
  }
};

const reset = async function(req, res) {
  try {
    await Repository.reset(req.params.name);
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to reset repository", err.toString()));
  }
};

const pull = async function(req, res) {
  try {
    await Repository.pull(req.params.name);
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error("Failed to pull repository", err.toString()));
  }
};

export default {
    find,
    create,
    findByName,
    update,
    "delete": deleteRepository,
    clone,
    reset,
    pull
};