'use strict';
import Repository from '../../models/repository.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import cronService from '../../services/cron.service.js';
import logger from '../../lib/logger.js';
import i18n from '../../lib/i18n.js';

const find = async function(req, res) {
  try {
    const repositories = await Repository.findAll();
    res.json(RestResult.list(repositories));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindRepositories'), err.toString()));
  }
};

const create = async function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0) {
    return res.status(400).json(RestResult.error(i18n.t(req, 'errors.requiredFields')));
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
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedCreateRepository'), err.toString()));
  }
};

const findByName = async function(req, res) {
  try {
    const repository = await Repository.findByName(req.params.name);
    repository.password = "**********"; // mask the password for api
    res.json(RestResult.single(repository));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindRepository'), err.toString()));
  }
};

const update = async function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0) {
    return res.status(400).json(RestResult.error(i18n.t(req, 'errors.requiredFields')));
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
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedUpdateRepository'), err.toString()));
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
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedDeleteRepository'), err.toString()));
  }
};

const clone = async function(req, res) {
  try {
    await Repository.clone(req.params.name);
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedCloneRepository'), err.toString()));
  }
};

const reset = async function(req, res) {
  try {
    await Repository.reset(req.params.name);
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedResetRepository'), err.toString()));
  }
};

const pull = async function(req, res) {
  try {
    await Repository.pull(req.params.name);
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedPullRepository'), err.toString()));
  }
};

const sync = async function(req, res) {
  try {
    const output = await Repository.sync(req.params.name, req.user?.user?.username);
    res.json(RestResult.single({ output }));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedSyncRepository'), err.toString()));
  }
};

// designer-facing : list the forms repositories (no credentials exposed) with
// a 'dirty' flag (uncommitted/unpushed changes) and the config-origin repo name
const formsRepos = async function(req, res) {
  try {
    const { repositories, configRepo, staged } = await Repository.formsRepoStatus();
    res.json(RestResult.single({ count: repositories.length, repositories, configRepo, staged }));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindRepositories'), err.toString()));
  }
};

// designer-facing : commit & push one forms repository by name
const formsRepoSync = async function(req, res) {
  try {
    const repositories = await Repository.findPushableRepositories();
    if (!repositories.some(r => r.name === req.params.name)) {
      return res.status(400).json(RestResult.error(i18n.t(req, 'resources.noFormsRepositories')));
    }
    const output = await Repository.sync(req.params.name, req.user?.user?.username);
    res.json(RestResult.single({ output }));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedSyncRepository'), err.toString()));
  }
};

// designer-facing : commit & push all forms repositories
const formsRepoSyncAll = async function(req, res) {
  try {
    const repositories = await Repository.findPushableRepositories();
    if (repositories.length === 0) {
      return res.status(400).json(RestResult.error(i18n.t(req, 'resources.noFormsRepositories')));
    }
    const results = [];
    var failed = false;
    for (const repo of repositories) {
      try {
        const output = await Repository.sync(repo.name, req.user?.user?.username);
        results.push({ name: repo.name, status: "success", output });
      } catch (e) {
        failed = true;
        results.push({ name: repo.name, status: "failed", output: e.message });
      }
    }
    if (failed) {
      return res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedSyncRepository'), results.filter(r => r.status === "failed").map(r => `${r.name} : ${r.output}`).join("\n")));
    }
    res.json(RestResult.single({ results }));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedSyncRepository'), err.toString()));
  }
};

// designer-facing : pull one forms repository from its remote by name
const formsRepoPull = async function(req, res) {
  try {
    const repositories = await Repository.findPushableRepositories();
    if (!repositories.some(r => r.name === req.params.name)) {
      return res.status(400).json(RestResult.error(i18n.t(req, 'resources.noFormsRepositories')));
    }
    await Repository.pull(req.params.name);
    res.json(RestResult.single(null));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedPullRepository'), err.toString()));
  }
};

// designer-facing : pull all forms repositories from their remote (refresh the
// working trees so the designer shows the latest remote state)
const formsRepoPullAll = async function(req, res) {
  try {
    const repositories = await Repository.findPushableRepositories();
    if (repositories.length === 0) {
      return res.status(400).json(RestResult.error(i18n.t(req, 'resources.noFormsRepositories')));
    }
    const results = [];
    var failed = false;
    for (const repo of repositories) {
      try {
        await Repository.pull(repo.name);
        results.push({ name: repo.name, status: "success" });
      } catch (e) {
        failed = true;
        results.push({ name: repo.name, status: "failed", output: e.message });
      }
    }
    if (failed) {
      return res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedPullRepository'), results.filter(r => r.status === "failed").map(r => `${r.name} : ${r.output}`).join("\n")));
    }
    res.json(RestResult.single({ results }));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedPullRepository'), err.toString()));
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
    pull,
    sync,
    formsRepos,
    formsRepoSync,
    formsRepoSyncAll,
    formsRepoPull,
    formsRepoPullAll
};