// Secret stores : HashiCorp Vault, CyberArk, ... One row per store ; credentials name the
// store and the place in it (credentials.secret_store / secret_ref).
import CrudModel from './crud.model.js';
import Errors from '../lib/errors.js';
import { SECRET_MASK, isMasked } from '../lib/secretMask.js';
import { SECRET_STORE_TYPES } from '../secrets/providers/index.js';
import { clearSecretCache } from '../secrets/cache.js';
import { stripTrailingSlashes } from '../lib/url.js';
import Credential from './credential.model.v2.js';

// what secretStore.controller.js shows instead of a stored secret
// the mask a secret is shown as, for whoever imported it from here (lib/secretMask.js)
export { SECRET_MASK };

class SecretStore extends CrudModel {
  static modelName = 'secretstore';

  // The admin page sends '' for a number left empty, and an int column refuses '' in strict
  // mode ; `extra` is free JSON, checked here so a typo is a 400 rather than a store that
  // silently ignores its options.
  static normalize(data, { creating }) {
    // the api hands token and client_key out masked ; the mask sent back means "unchanged"
    for (const key of ['token', 'client_key']) {
      if (isMasked(data[key])) delete data[key];
    }
    if (data.type !== undefined && !SECRET_STORE_TYPES.includes(data.type)) {
      throw new Errors.BadRequestError(`Unknown secret store type '${data.type}' - use one of ${SECRET_STORE_TYPES.join(', ')}`);
    }
    if (typeof data.url === 'string') data.url = stripTrailingSlashes(data.url.trim());
    if (data.kv_version !== undefined) {
      const v = data.kv_version === '' || data.kv_version === null ? 2 : parseInt(data.kv_version, 10);
      if (![1, 2].includes(v)) throw new Errors.BadRequestError('kv_version must be 1 or 2');
      data.kv_version = v;
    } else if (creating) {
      data.kv_version = 2;
    }
    if (data.cache_ttl_seconds !== undefined) {
      const ttl = data.cache_ttl_seconds === '' || data.cache_ttl_seconds === null ? 60 : parseInt(data.cache_ttl_seconds, 10);
      if (!Number.isFinite(ttl) || ttl < 0) throw new Errors.BadRequestError('cache_ttl_seconds must be 0 or more');
      data.cache_ttl_seconds = ttl;
    }
    if (data.extra !== undefined) {
      if (data.extra === '' || data.extra === null) {
        data.extra = null;
      } else {
        let extra = data.extra;
        if (typeof extra === 'string') {
          try { extra = JSON.parse(extra); } catch (e) {
            throw new Errors.BadRequestError(`extra is not valid JSON: ${e.message}`);
          }
        }
        if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
          throw new Errors.BadRequestError('extra must be a JSON object');
        }
        data.extra = JSON.stringify(extra);
      }
    }
    return data;
  }

  /**
   * Checks the credential a store is given : it exists, and it keeps its password itself. A
   * credential that reads its password from a secret store would make this store read a store
   * to find its own token (itself, in the worst case).
   *
   * Args:
   *   data (object): the fields being saved ; an empty credential means none.
   *   id (number): the store updated ; none on a create.
   *
   * Raises:
   *   BadRequestError: the credential does not exist, or reads from a secret store.
   */
  static async assertCredentialUsable(data, id) {
    if (data.credential === undefined) return;
    if (data.credential === '' || data.credential === null) {
      data.credential = null;
      return;
    }
    const cred = await CrudModel.findByName('credential', data.credential);
    if (!cred) throw new Errors.BadRequestError(`No credential named '${data.credential}'`);
    // a CyberArk logs in with a cyberark credential (its AppID), a Vault with a vault one (its
    // password the token) ; the store's type is the one sent, else the one saved
    const type = data.type || (id !== undefined ? (await this.findById(id))?.type : undefined);
    const wanted = type === 'cyberark_ccp' ? 'cyberark' : 'vault';
    if (type && cred.credential_type !== wanted) {
      throw new Errors.BadRequestError(
        type === 'cyberark_ccp'
          ? `A CyberArk secret store needs a cyberark credential: '${data.credential}' is not one`
          : `A HashiCorp Vault secret store needs a vault credential: '${data.credential}' is not one`,
      );
    }
    if (cred.secret_store) {
      throw new Errors.BadRequestError(
        `The credential '${data.credential}' reads its password from a secret store: a secret store needs one that keeps its own`,
      );
    }
  }

  /**
   * The store with what it logs in with, from its credential when it names one : a Vault's
   * token (the credential's password), a CyberArk's AppID and client certificate and key.
   * Else its own. Where the store is used only - never for the API.
   *
   * Args:
   *   store (object): the store record, its secrets decrypted.
   *
   * Returns:
   *   Promise<object>: a copy with its login set from its credential, or the record.
   *
   * Raises:
   *   Error: the credential it names does not exist, or reads from a secret store.
   */
  static async withCredential(store) {
    if (!store?.credential) return store;
    const cred = await CrudModel.findByName('credential', store.credential);
    if (!cred) throw new Error(`Secret store '${store.name}' uses the credential '${store.credential}', which is not found`);
    if (cred.secret_store) {
      throw new Error(`Secret store '${store.name}' uses the credential '${store.credential}', which reads from a secret store itself`);
    }
    // a CyberArk : its AppID and client certificate and key ; a Vault : its token
    if (store.type === 'cyberark_ccp') {
      return { ...store, app_id: cred.user, client_cert: cred.client_cert, client_key: cred.client_key };
    }
    return { ...store, token: cred.password };
  }

  /**
   * The store with where it connects : its credential's address and TLS when that carries an
   * address, else its own (a store from before 7.3, or one the config seed declares with its own).
   *
   * Args:
   *   store (object): the store record.
   *
   * Returns:
   *   Promise<object>: a copy with its url, ignore_certs and ca_bundle its credential's, or the
   *     record.
   */
  static async withConnection(store) {
    if (!store?.credential) return store;
    const conn = await Credential.connectionOf(store.credential).catch(() => null);
    return conn ? { ...store, ...conn } : store;
  }

  /**
   * Where a store written through the API connects : its credential's address empties its own
   * (one place for it), and a store needs one of the two.
   *
   * Args:
   *   data (object): the fields being saved.
   *   current (object): the store as stored ; none on a create.
   *   creating (boolean): a create (an update of a store not found is refused elsewhere).
   *
   * Raises:
   *   BadRequestError: neither its credential nor itself has an address.
   */
  static async takeConnection(data, current, creating = false) {
    const credential = data.credential !== undefined ? data.credential : current?.credential;
    if (await Credential.connectionOf(credential).catch(() => null)) {
      data.url = '';
      data.ignore_certs = 0;
      data.ca_bundle = null;
      return;
    }
    const url = data.url !== undefined ? data.url : current?.url;
    if ((creating || current) && !String(url || '').trim()) {
      throw new Errors.BadRequestError('A secret store needs its address: a credential with a server address, or its own url');
    }
  }

  // opts carries { fromSeed:true } for the declarative config seed only
  static async create(data, opts = {}) {
    // the config seed may create its stores before the credentials they name : checked on use
    if (!opts.fromSeed) {
      await this.assertCredentialUsable(data);
      await this.takeConnection(data, undefined, true);
    }
    const res = await super.create(this.modelName, this.normalize(data, { creating: true }), opts);
    clearSecretCache();
    return res;
  }

  static async update(data, id, opts = {}) {
    if (!opts.fromSeed) {
      await this.assertCredentialUsable(data, id);
      await this.takeConnection(data, await super.findById(this.modelName, id));
    }
    // its type stays what it was made as (the credentials that read from it expect it) ; the
    // config seed may change it
    if (!opts.fromSeed && data.type !== undefined) {
      const current = await this.findById(id);
      if (current?.type && data.type !== current.type) {
        throw new Errors.BadRequestError(`A secret store keeps the type it was made as: '${current.name}' is ${current.type}. Make a new secret store for another type`);
      }
    }
    // a Vault Enterprise (a namespace) stays one, and a Vault without stays without : a part of its
    // type, the paths of the credentials that read from it expect it ; the config seed may change it
    if (!opts.fromSeed && data.namespace !== undefined) {
      const current = await this.findById(id);
      const was = !!String(current?.namespace || "").trim();
      const now = !!String(data.namespace || "").trim();
      if (current?.type === "vault" && was !== now) {
        throw new Errors.BadRequestError(
          was
            ? `'${current.name}' is a Vault Enterprise: its namespace is required`
            : `'${current.name}' is not a Vault Enterprise: it takes no namespace. Make a new secret store for a Vault Enterprise`,
        );
      }
    }
    const res = await super.update(this.modelName, this.normalize(data, { creating: false }), id, opts);
    clearSecretCache();
    return res;
  }

  static async delete(id, opts = {}) {
    const res = await super.delete(this.modelName, id, opts);
    clearSecretCache();
    return res;
  }

  // read as they connect : a store naming a credential with an address has its address and TLS
  static async findAll() {
    const rows = await super.findAll(this.modelName);
    return Promise.all((rows || []).map((r) => this.withConnection(r)));
  }

  static async findById(id) {
    return this.withConnection(await super.findById(this.modelName, id));
  }

  static async findByName(name) {
    return this.withConnection(await super.findByName(this.modelName, name));
  }

  /** `extra` as an object ; {} when empty or unreadable */
  static extraOf(store) {
    if (!store?.extra) return {};
    if (typeof store.extra === 'object') return store.extra;
    try { return JSON.parse(store.extra) || {}; } catch { return {}; }
  }
}

export default SecretStore;
