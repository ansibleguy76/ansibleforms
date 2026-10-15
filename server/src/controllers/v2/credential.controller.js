import CredentialModel from '../../models/credential.model.v2.js';
import RestResult from '../../models/restResult.model.v2.js';
import Errors from '../../lib/errors.js';
import i18n from '../../lib/i18n.js';
import mysql from '../../lib/mysql.js';
import postgres from '../../lib/postgres.js';
import mssql from '../../lib/mssql.js';
import oracle from '../../lib/oracle.js';
import mongodb from '../../lib/mongodb.js';
import auth_entraid from '../../auth/auth_entraid.js';
import auth_oidc from '../../auth/auth_oidc.js';
import logger from '../../lib/logger.js';
import Form from '../../models/form.model.js';
import { formCredentials } from '../../lib/formLinks.js';
import { workflowCredentials } from '../../models/workflowRun.js';

// the credential types an SSO provider signs in with : a change to one of them is a change to the
// sign-in, which reads its client, tenant or issuer and redirect URL when it starts
const SSO_TYPES = ['entraid', 'oidc'];

/**
 * Starts the SSO sign-ins again, with their credentials as they are now. A failure is logged : the
 * credential was saved, its provider says why it cannot sign in.
 *
 * Returns:
 *   Promise<void>: settles once both have started.
 */
async function reloadSso() {
  try {
    await auth_entraid.initialize();
    await auth_oidc.initialize();
  } catch (err) {
    logger.error(`Could not start the SSO sign-in again after a credential changed : ${err?.message || err}`);
  }
}

const credentialController = {
  async find(req, res) {
    try {
      if (req.query.name) {
        const credential = await CredentialModel.findByName(req.query.name);
        // Mask password before returning to API
        if (credential && credential.password) {
          credential.password = '**********';
        }
        if (credential && credential.client_key) credential.client_key = '**********';
        res.json(RestResult.single(credential));
      } else {
        // how many records use each (used_by_count), as its Used by tab lists them ; a count that
        // cannot be read leaves the list as it is
        const usage = await CredentialModel.usageCounts().catch(() => new Map());
        // and the forms that name each (a form counts once per credential, wherever it names it)
        try {
          const config = await Form.load(undefined, undefined, true);
          for (const form of formCredentials(config.forms)) {
            for (const name of new Set(form.credentials.map((c) => c.name))) usage.set(name, (usage.get(name) || 0) + 1);
          }
        } catch (err) {
          logger.debug(`The forms are left out of the credentials' Used by count : ${err?.message || err}`);
        }
        // and the designer's workflows whose nodes name each (a workflow counts once per credential)
        try {
          for (const wf of await workflowCredentials()) {
            for (const name of new Set(wf.credentials.map((c) => c.name))) usage.set(name, (usage.get(name) || 0) + 1);
          }
        } catch (err) {
          logger.debug(`The workflows are left out of the credentials' Used by count : ${err?.message || err}`);
        }
        const credentials = (await CredentialModel.findAll()).map((c) => ({
          ...c,
          // Mask passwords before returning to API
          password: c.password ? '**********' : c.password,
          client_key: c.client_key ? '**********' : c.client_key,
          used_by_count: usage.get(c.name) || 0,
        }));
        res.json(RestResult.list(credentials));
      }
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async create(req, res) {
    try {
      const credential = await CredentialModel.create(req.body);
      res.json(RestResult.single({ message: i18n.t(req, 'success.created', { resource: 'Credential' }), id: credential }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async findById(req, res) {
    try {
      const credential = await CredentialModel.findById(req.params.id);
      // Mask password before returning to API
      credential.password = '**********';
      if (credential.client_key) credential.client_key = '**********';
      res.json(RestResult.single(credential));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async update(req, res) {
    try {
      const before = await CredentialModel.findById(req.params.id).catch(() => null);
      await CredentialModel.update(req.body, req.params.id);
      if ([before?.credential_type, req.body?.credential_type].some((t) => SSO_TYPES.includes(t))) await reloadSso();
      res.json(RestResult.single({ message: i18n.t(req, 'success.updated', { resource: 'Credential' }) }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async delete(req, res) {
    try {
      const before = await CredentialModel.findById(req.params.id).catch(() => null);
      await CredentialModel.delete(req.params.id);
      if (SSO_TYPES.includes(before?.credential_type)) await reloadSso();
      res.json(RestResult.single({ message: i18n.t(req, 'success.deleted', { resource: 'Credential' }) }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  },

  async testDb(req, res) {
    try {
      const credential = await CredentialModel.findById(req.params.id);
      const db_type = credential.db_type;
      if (db_type === 'mysql') {
        await mysql.query(credential.name, 'select 1');
      } else if (db_type === 'mssql') {
        await mssql.query(credential.name, 'select 1');
      } else if (db_type === 'postgres') {
        await postgres.query(credential.name, 'select 1');
      } else if (db_type === 'oracle') {
        await oracle.query(credential.name, 'select 1');
      } else if (db_type === 'mongodb') {
        await mongodb.query(credential.name, 'admin~system.version~{}');
      } else {
        throw new Errors.BadRequestError(i18n.t(req, 'resources.dbTypeNotSet'));
      }
      res.json(RestResult.single({ message: i18n.t(req, 'success.connectionOk', { resource: 'Database' }) }));
    } catch (err) {
      Errors.ReturnError(res, err);
    }
  }
};

export default credentialController;
