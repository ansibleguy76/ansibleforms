/******************************************************************/
/*                                                                */
/*  The files a job runs from, sent by the app with the job       */
/*  (RTE_FILES=transfer, the socket modes' default) : the         */
/*  playbooks folder and the inventories, each a tar.gz the app   */
/*  names by a hash of its content. The RTE keeps the packed      */
/*  ones it got (RTE_CACHE_PATH) and asks for a hash it does not  */
/*  have. Each job unpacks them in a private folder of its own,   */
/*  removed when it ends : no job sees what another one wrote,    */
/*  and no inventory stays unpacked on the disk.                  */
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
// a bundle's name : its hash, then the packed suffix
const HASH = /^[a-f0-9]{64}$/;
const SUFFIX = ".tar.gz";
// the folder, under the cache, that holds the running jobs' folders, one per RTE
const JOBS = "jobs";

/**
 * The bundles this RTE has, on its disk, and the folders its jobs run from.
 */
export class FileCache {
  /**
   * Args:
   *   dir (string): the cache folder (RTE_CACHE_PATH).
   *   keep (number): the bundles kept ; the ones used longest ago go first.
   *   owner (string): the RTE (its node id) : its jobs' folders go under jobs/<owner>, so RTEs
   *     that share the cache never remove each other's.
   */
  constructor(dir, keep = 20, owner = "rte") {
    this.dir = dir;
    this.keep = keep;
    this.jobsDir = path.join(dir, JOBS, String(owner).replace(/[^A-Za-z0-9._-]/g, "_") || "rte");
    // hash -> { promise, resolve, reject, file, stream, hasher, timer } : a bundle being received
    this.pending = new Map();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this._prune();
  }

  /**
   * A bundle's file.
   *
   * Args:
   *   hash (string): its hash.
   *
   * Returns:
   *   string: the file.
   */
  path(hash) {
    if (!HASH.test(String(hash))) throw new Error(`not a bundle hash: ${hash}`);
    return path.join(this.dir, `${hash}${SUFFIX}`);
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
    return fs.existsSync(this.path(hash));
  }

  /**
   * A bundle's file, asking the app for it when it is not here. Two jobs asking for the same
   * bundle at once wait for one transfer.
   *
   * Args:
   *   hash (string): its hash.
   *   ask (function): (hash) => boolean : asks the app (a fetch message) ; false when the socket
   *     is not open.
   *
   * Returns:
   *   Promise<string>: the file.
   *
   * Raises:
   *   Error: the app could not send it, or it did not arrive whole in time.
   */
  async ensure(hash, ask) {
    const file = this.path(hash);
    if (this.has(hash)) {
      const now = new Date();
      fs.utimesSync(file, now, now);
      return file;
    }
    if (this.pending.has(hash)) return this.pending.get(hash).promise;
    const entry = {};
    entry.promise = new Promise((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;
    });
    entry.file = path.join(this.dir, `${hash}.part`);
    entry.stream = fs.createWriteStream(entry.file, { mode: 0o600 });
    // a disk full, a folder gone : the transfer fails, the job with it (never an uncaught error)
    entry.stream.on("error", (e) => this._fail(hash, new Error(`the job's files ${hash.slice(0, 12)} could not be written: ${e.message}`)));
    entry.hasher = crypto.createHash("sha256");
    entry.timer = setTimeout(() => this._fail(hash, new Error(`the files ${hash.slice(0, 12)} did not arrive within ${FETCH_TIMEOUT_MS / 60000} minutes`)), FETCH_TIMEOUT_MS);
    entry.timer.unref?.();
    this.pending.set(hash, entry);
    if (!ask(hash)) this._fail(hash, new Error("not connected to the app: the job's files cannot be fetched"));
    return entry.promise;
  }

  /**
   * A private folder for a job (0700, a random name), under this RTE's jobs folder : its
   * bundles are unpacked in it, and it goes when the job ends (release).
   *
   * Args:
   *   jobId (number): the job.
   *
   * Returns:
   *   string: the folder.
   */
  jobFolder(jobId) {
    fs.mkdirSync(this.jobsDir, { recursive: true, mode: 0o700 });
    const folder = fs.mkdtempSync(path.join(this.jobsDir, `${parseInt(jobId, 10) || 0}-`));
    // mkdtemp makes it 0700 already : said again, whatever the platform
    fs.chmodSync(folder, 0o700);
    return folder;
  }

  /**
   * A bundle unpacked in a job's folder, fetched first when it is not here.
   *
   * Args:
   *   hash (string): its hash.
   *   ask (function): as for ensure.
   *   into (string): the folder it is unpacked in (made here, inside the job's folder).
   *
   * Returns:
   *   Promise<string>: the folder.
   *
   * Raises:
   *   Error: the app could not send it, or it could not be unpacked.
   */
  async checkout(hash, ask, into) {
    // step 1 : the packed bundle ; one another job's eviction took meanwhile is fetched again
    let file = await this.ensure(hash, ask);
    fs.mkdirSync(into, { recursive: true, mode: 0o700 });
    try {
      await tar.x({ file, cwd: into, strict: true });
    } catch (e) {
      if (e.code !== "ENOENT" || fs.existsSync(file)) throw e;
      file = await this.ensure(hash, ask);
      await tar.x({ file, cwd: into, strict: true });
    }
    return into;
  }

  /**
   * A job's folder removed, with everything the job wrote in it.
   *
   * Args:
   *   folder (string): the folder jobFolder gave ; nothing outside this RTE's jobs folder is
   *     removed.
   */
  release(folder) {
    if (!folder || path.dirname(folder) !== this.jobsDir) return;
    try {
      fs.rmSync(folder, { recursive: true, force: true });
    } catch (e) {
      logger.warning(`RTE: could not remove the job folder ${folder}: ${e.message}`);
    }
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

  /** the last chunk came : checked, read through once, kept packed */
  _finish(hash, sha256) {
    const entry = this.pending.get(hash);
    if (!entry) return;
    entry.stream.end(async (err) => {
      // the stream failed meanwhile : its error listener failed the transfer already
      if (err || this.pending.get(hash) !== entry) return;
      try {
        const got = entry.hasher.digest("hex");
        if (sha256 && got !== sha256) throw new Error(`the job's files arrived damaged (sha256 ${got} instead of ${sha256})`);
        // a file that is not a whole tar.gz is refused now, not by every job that would use it
        await tar.t({ file: entry.file, strict: true });
        fs.renameSync(entry.file, this.path(hash));
        clearTimeout(entry.timer);
        this.pending.delete(hash);
        logger.notice(`RTE: received the job files ${hash.slice(0, 12)}`);
        entry.resolve(this.path(hash));
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
    // what was written goes ; a file that cannot go (the error that failed it) does not stop the
    // job from hearing why
    try {
      fs.rmSync(entry.file, { force: true });
    } catch (e) {
      logger.debug(`RTE: could not remove ${entry.file}: ${e.message}`);
    }
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
        .filter((n) => n.endsWith(SUFFIX) && HASH.test(n.slice(0, -SUFFIX.length)))
        .map((n) => ({ n, t: fs.statSync(path.join(this.dir, n)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
    } catch {
      return;
    }
    for (const e of entries.slice(this.keep)) {
      fs.rmSync(path.join(this.dir, e.n), { force: true });
    }
  }

  /**
   * At start : what an earlier start left goes - this RTE's job folders (none of its jobs runs
   * yet), transfers older than a transfer may take, and bundles of an earlier layout, kept
   * unpacked. Another RTE sharing the cache keeps its job folders and its transfers.
   */
  _prune() {
    const remove = (target) => {
      try {
        fs.rmSync(target, { recursive: true, force: true });
      } catch (e) {
        logger.warning(`RTE: could not remove ${target}: ${e.message}`);
      }
    };
    remove(this.jobsDir);
    let names;
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return;
    }
    const stale = Date.now() - FETCH_TIMEOUT_MS;
    for (const n of names) {
      const target = path.join(this.dir, n);
      if (n.endsWith(".unpack") || HASH.test(n)) remove(target);
      else if (n.endsWith(".part")) {
        try {
          if (fs.statSync(target).mtimeMs < stale) remove(target);
        } catch {
          // gone meanwhile
        }
      }
    }
  }
}

export default FileCache;
