// The syslog servers the app sends its server log and its audit entries to (Settings >
// Connections > Syslog) : several can be kept, each enabled or not, each getting the server log,
// the audit entries, or both. A change is applied to the logger of every process
// (lib/syslogServers.js) : here at once, on the other nodes through the epochs.
import CrudModel from './crud.model.js';
import Errors from '../lib/errors.js';
import { SYSLOG_PROTOCOLS, SYSLOG_LEVELS, SYSLOG_TYPES, SYSLOG_RECEIVES } from '../lib/syslogOptions.js';

class SyslogServer extends CrudModel {
  static modelName = 'syslogserver';

  /**
   * Checks the fields of a server being saved, and fills the ones left empty with their
   * default : a host for a network protocol, a path for a unix socket, a known protocol, level,
   * type and what it receives, a port between 1 and 65535.
   *
   * Args:
   *   data (object): the fields being saved.
   *   existing (object): the server as stored, on an update ; null on a create.
   *
   * Raises:
   *   BadRequestError: a field is not valid.
   */
  static normalise(data, existing = null) {
    const merged = { ...(existing || {}), ...data };
    for (const [key, allowed] of [
      ['protocol', SYSLOG_PROTOCOLS],
      ['level', SYSLOG_LEVELS],
      ['type', SYSLOG_TYPES],
      ['receives', SYSLOG_RECEIVES],
    ]) {
      if (data[key] === undefined) continue;
      if (data[key] === '' || data[key] === null) {
        // the default, as a new server's
        data[key] = null;
        continue;
      }
      if (!allowed.includes(String(data[key]))) {
        throw new Errors.BadRequestError(`A syslog server's ${key} is one of ${allowed.join(', ')}: '${data[key]}' is not`);
      }
    }
    if (data.port !== undefined && data.port !== '' && data.port !== null) {
      const port = Number(data.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Errors.BadRequestError(`A syslog server's port is a number from 1 to 65535: '${data.port}' is not`);
      }
      data.port = port;
    } else if (data.port === '') {
      data.port = null;
    }
    const protocol = data.protocol || merged.protocol || 'udp4';
    if (protocol.startsWith('unix')) {
      if (!String(merged.path || '').trim()) throw new Errors.BadRequestError('A syslog server on a unix socket needs its path');
    } else if (!String(merged.host || '').trim()) {
      throw new Errors.BadRequestError('A syslog server needs its host');
    }
    // the defaults, written so the table and the API say what is used
    if (!existing) {
      data.protocol = data.protocol || 'udp4';
      data.level = data.level || 'info';
      data.type = data.type || 'BSD';
      data.receives = data.receives || 'both';
      if (data.enabled === undefined) data.enabled = 1;
    } else {
      for (const [key, fallback] of [['protocol', 'udp4'], ['level', 'info'], ['type', 'BSD'], ['receives', 'both']]) {
        if (data[key] === null) data[key] = fallback;
      }
    }
  }

  // opts carries { fromSeed:true } for the declarative config seed only
  static async create(data, opts = {}) {
    this.normalise(data);
    const id = await super.create(this.modelName, data, opts);
    await this.applied();
    return id;
  }

  static async update(data, id, opts = {}) {
    const existing = await this.findById(id);
    if (!existing) throw new Errors.NotFoundError(`No syslog server with id ${id}`);
    this.normalise(data, existing);
    const res = await super.update(this.modelName, data, id, opts);
    await this.applied();
    return res;
  }

  static async delete(id, opts = {}) {
    const res = await super.delete(this.modelName, id, opts);
    await this.applied();
    return res;
  }

  static async findAll() {
    return super.findAll(this.modelName);
  }

  static async findById(id) {
    return super.findById(this.modelName, id);
  }

  static async findByName(name) {
    return super.findByName(this.modelName, name);
  }

  /**
   * The servers changed : this process's logger follows now (the other processes on the
   * epoch CrudModel bumped). Never fails the save : the logger says what it could not apply.
   */
  static async applied() {
    try {
      const { reloadSyslogServers } = await import('../lib/syslogServers.js');
      await reloadSyslogServers();
    } catch {
      // reloadSyslogServers logs its own failure
    }
  }
}

export default SyslogServer;
