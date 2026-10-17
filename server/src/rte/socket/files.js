/******************************************************************/
/*                                                                */
/*  The files a job runs from, sent by the app with the job       */
/*  (RTE_FILES=transfer, the socket modes' default) : the         */
/*  playbooks folder and the inventories, each a tar.gz the app   */
/*  names by a hash of its content. The RTE keeps the ones it got */
/*  (RTE_CACHE_PATH), asks for a hash it does not have, and runs  */
/*  the job from there : no shared disk, no repository access.    */
/*                                                                */
/*  As ansible-runner's transmit / worker split hands a job and   */
/*  its project to an execution node.                             */
/*                                                                */
/******************************************************************/
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as tar from "tar";
import logger from "../../lib/logger.js";

// how long the app may take to send a bundle
const FETCH_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The bundles this RTE has, on its disk.
 */
export class FileCache {
  /**
   * Args:
   *   dir (string): the cache folder (RTE_CACHE_PATH).
   *   keep (number): the bundles kept ; the ones used longest ago go first.
   */
  constructor(dir, keep = 20) {
    this.dir = dir;
    this.keep = keep;
    // hash -> { promise, resolve, reject, file, stream, hasher, timer } : a bundle being received
    this.pending = new Map();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  /**
   * A bundle's folder.
   *
   * Args:
   *   hash (string): its hash.
   *
   * Returns:
   *   string: the folder.
   */
  path(hash) {
    if (!/^[a-f0-9]{64}$/.test(String(hash))) throw new Error(`not a bundle hash: ${hash}`);
    return path.join(this.dir, hash);
  }

  /**
   * Whether a bundle is here, whole.
   *
   * Args:
   *   hash (string): its hash.
   *
   * Returns:
   *   boolean
   */
  has(hash) {
    return fs.existsSync(path.join(this.path(hash), ".af-complete"));
  }

  /**
   * A bundle's folder, asking the app for it when it is not here. Two jobs asking for the same
   * bundle at once wait for one transfer.
   *
   * Args:
   *   hash (string): its hash.
   *   ask (function): (hash) => boolean : asks the app (a fetch message) ; false when the socket
   *     is not open.
   *
   * Returns:
   *   Promise<string>: the folder.
   *
   * Raises:
   *   Error: the app could not send it, or it did not arrive whole in time.
   */
  async ensure(hash, ask) {
    const folder = this.path(hash);
    if (this.has(hash)) {
      const now = new Date();
      fs.utimesSync(folder, now, now);
      return folder;
    }
    if (this.pending.has(hash)) return this.pending.get(hash).promise;
    const entry = {};
    entry.promise = new Promise((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;
    });
    entry.file = path.join(this.dir, `${hash}.part`);
    entry.stream = fs.createWriteStream(entry.file, { mode: 0o600 });
    entry.hasher = crypto.createHash("sha256");
    entry.timer = setTimeout(() => this._fail(hash, new Error(`the files ${hash.slice(0, 12)} did not arrive within ${FETCH_TIMEOUT_MS / 60000} minutes`)), FETCH_TIMEOUT_MS);
    entry.timer.unref?.();
    this.pending.set(hash, entry);
    if (!ask(hash)) this._fail(hash, new Error("not connected to the app: the job's files cannot be fetched"));
    return entry.promise;
  }

  /**
   * A chunk of a bundle from the app.
   *
   * Args:
   *   msg (object): { hash, data (base64), last, sha256 (with the last), error }.
   */
  deliver(msg) {
    const entry = this.pending.get(msg.hash);
    if (!entry) return;
    if (msg.error) return this._fail(msg.hash, new Error(`the app could not send the job's files: ${msg.error}`));
    if (msg.data) {
      const buf = Buffer.from(msg.data, "base64");
      entry.hasher.update(buf);
      entry.stream.write(buf);
    }
    if (msg.last) this._finish(msg.hash, msg.sha256);
  }

  /** the last chunk came : checked, unpacked, kept */
  _finish(hash, sha256) {
    const entry = this.pending.get(hash);
    entry.stream.end(async () => {
      try {
        const got = entry.hasher.digest("hex");
        if (sha256 && got !== sha256) throw new Error(`the job's files arrived damaged (sha256 ${got} instead of ${sha256})`);
        const folder = this.path(hash);
        const work = `${folder}.unpack`;
        fs.rmSync(work, { recursive: true, force: true });
        fs.mkdirSync(work, { recursive: true });
        await tar.x({ file: entry.file, cwd: work, strict: true });
        fs.writeFileSync(path.join(work, ".af-complete"), new Date().toISOString());
        fs.rmSync(folder, { recursive: true, force: true });
        fs.renameSync(work, folder);
        fs.rmSync(entry.file, { force: true });
        clearTimeout(entry.timer);
        this.pending.delete(hash);
        logger.notice(`RTE: received the job files ${hash.slice(0, 12)}`);
        entry.resolve(folder);
        this._evict();
      } catch (e) {
        this._fail(hash, e);
      }
    });
  }

  /** a bundle that will not come */
  _fail(hash, err) {
    const entry = this.pending.get(hash);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(hash);
    entry.stream.destroy();
    fs.rmSync(entry.file, { force: true });
    entry.reject(err);
  }

  /** every bundle being received fails (the socket closed) */
  failAll(err) {
    for (const hash of [...this.pending.keys()]) this._fail(hash, err);
  }

  /** the bundles beyond `keep`, used longest ago, go */
  _evict() {
    let entries;
    try {
      entries = fs.readdirSync(this.dir)
        .filter((n) => /^[a-f0-9]{64}$/.test(n))
        .map((n) => ({ n, t: fs.statSync(path.join(this.dir, n)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
    } catch {
      return;
    }
    for (const e of entries.slice(this.keep)) {
      fs.rmSync(path.join(this.dir, e.n), { recursive: true, force: true });
    }
  }
}

export default FileCache;
