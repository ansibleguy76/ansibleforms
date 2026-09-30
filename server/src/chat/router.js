'use strict';
import express from 'express';
import logger from '../lib/logger.js';
import Form from '../models/form.model.js';
import Job from '../models/job.model.js';
import Expression from '../models/expression.model.js';
import Query from '../models/query.model.js';
import { resolveFormQuery } from '../lib/queryPolicy.js';
import { createChatService, errorStatus } from './service.js';

/**
 * /api/v2/chat - mounted only with ENABLE_CHAT, behind the JWT middleware and the allowChat
 * role option (app.js). Every call runs as the logged-in user, with the form roles and job
 * visibility they have in the browser.
 */
const deps = { Form, Job, Expression, Query, resolveFormQuery };
const service = createChatService({ deps });
const router = express.Router();

const handle = (fn) => async (req, res) => {
  const user = req?.user?.user;
  if (!user?.username) return res.status(401).json({ error: { code: 'unauthorized', message: 'Not logged in' } });
  try {
    res.json(await fn(user, req));
  } catch (err) {
    const known = errorStatus(err);
    if (known) return res.status(known.status).json(known.body);
    logger.error(`Chat error : ${err?.message || err}`);
    res.status(500).json({ error: { code: 'internal_error', message: 'The chat failed - see the server log' } });
  }
};

router.get('/config', handle(() => service.config()));
router.post('/session', handle((user) => service.openSession(user)));
router.post('/message', handle((user, req) => service.message(user, req.body || {})));
router.post('/approve', handle((user, req) => service.approve(user, req.body || {}, req.ip)));
router.post('/reset', handle((user, req) => service.reset(user, req.body || {})));

export default router;
