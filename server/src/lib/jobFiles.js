/******************************************************************/
/*                                                                */
/*  The files a job runs from, packed for a socket-mode RTE that  */
/*  has none of its own (RTE_FILES=transfer) : the playbooks      */
/*  folder and the inventories, each a tar.gz named by a hash of  */
/*  its content (the files' paths, sizes, times and modes). The   */
/*  RTE keeps what it got and asks only for a hash it has not     */
/*  seen : an unchanged folder is never sent twice.               */
/*                                                                */
/******************************************************************/
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import * as tar from "tar";
import logger from "./logger.js";

// where the app keeps the bundles it made
const BUNDLE_DIR = path.join(os.tmpdir(), "ansibleforms-bundles");
// what never goes : git's own folder, the job logs and the extravars files of running jobs
const SKIP_DIRS = new Set([".git", ".joblogs", "node_modules", "__pycache__"]);
const SKIP_FILE = /^(he_)?extravars_\d+\.json$/;
// a folder bigger than this is refused : mount it on the RTE instead (RTE_FILES=local)
const MAX_BYTES = Number(process.env.RTE_FILES_MAX_MB || 512) * 1024 * 1024;

// hash -> { file, sha256, size, root } : the bundles made by this process
const made = new Map();

/**
 * The files of a folder, as a sorted manifest : what the hash is made of.
 *
 * Args:
 *   root (string): the folder.
 *
 * Returns:
 *   { entries: string[], lines: string[], bytes: number }: the relative paths, the manifest
 *     lines, the total size.
 */
function manifest(root) {
  const entries = [];
  const lines = [];
  let bytes = 0;
  const walk = (dir, rel) => {
    let names;
    try {
      names = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    names.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const d of names) {
      const relPath = rel ? `${rel}/${d.name}` : d.name;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (SKIP_DIRS.has(d.name)) continue;
        walk(full, relPath);
      } else if (d.isFile() || d.isSymbolicLink()) {
        if (SKIP_FILE.test(d.name)) continue;
        let st;
        try {
          st = fs.statSync(full);
        } catch {
          continue;
        }
        if (!st.isFile()) continue;
        bytes += st.size;
        entries.push(relPath);
        lines.push(`${relPath}\t${st.size}\t${Math.floor(st.mtimeMs)}\t${(st.mode & 0o777).toString(8)}`);
      }
    }
  };
  walk(root, "");
  return { entries, lines, bytes };
}

/**
 * A folder's bundle : made when its content changed, else the one made before.
 *
 * Args:
 *   root (string): the folder.
 *
 * Returns:
 *   Promise<object|null>: { hash, file, sha256, size }, null when the folder does not exist.
 *
 * Raises:
 *   Error: the folder is bigger than RTE_FILES_MAX_MB.
 */
export async function bundleOf(root) {
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return null;
  const { entries, lines, bytes } = manifest(root);
  if (bytes > MAX_BYTES) {
    throw new Error(`the folder ${root} holds ${Math.round(bytes / 1048576)} MB, more than RTE_FILES_MAX_MB (${MAX_BYTES / 1048576}): mount it on the RTE and set RTE_FILES=local there`);
  }
  const hash = crypto.createHash("sha256").update(`${path.resolve(root)}\n${lines.join("\n")}`).digest("hex");
  const known = made.get(hash);
  if (known && fs.existsSync(known.file)) return { hash, ...known };
  fs.mkdirSync(BUNDLE_DIR, { recursive: true, mode: 0o700 });
  const file = path.join(BUNDLE_DIR, `${hash}.tgz`);
  if (!fs.existsSync(file)) {
    const part = `${file}.${process.pid}.part`;
    await tar.c({ gzip: true, file: part, cwd: root, portable: true, follow: true }, entries.length ? entries : ["."]);
    fs.renameSync(part, file);
    logger.info(`Packed the job files of ${root} (${entries.length} files, ${Math.round(bytes / 1024)} KB) as ${hash.slice(0, 12)}`);
  }
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const entry = { file, sha256, size: fs.statSync(file).size, root };
  made.set(hash, entry);
  return { hash, ...entry };
}

/**
 * A bundle made by this process, by its hash (an RTE's fetch).
 *
 * Args:
 *   hash (string): the hash.
 *
 * Returns:
 *   object|null: { file, sha256, size, root }.
 */
export function bundleByHash(hash) {
  const entry = made.get(hash);
  if (entry && fs.existsSync(entry.file)) return entry;
  // made by an earlier start of this node : still on disk, its checksum read again
  const file = path.join(BUNDLE_DIR, `${hash}.tgz`);
  if (/^[a-f0-9]{64}$/.test(String(hash)) && fs.existsSync(file)) {
    const again = { file, sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"), size: fs.statSync(file).size, root: null };
    made.set(hash, again);
    return again;
  }
  return null;
}

/**
 * Reads a bundle in chunks, for the socket.
 *
 * Args:
 *   file (string): the bundle's file.
 *   chunkBytes (number): the size of a chunk.
 *   onChunk (function): (buffer, last) => void : called for each chunk, in order.
 *
 * Returns:
 *   Promise<void>
 */
export async function readChunks(file, chunkBytes, onChunk) {
  const fd = await fs.promises.open(file, "r");
  try {
    const size = (await fd.stat()).size;
    let offset = 0;
    if (size === 0) return onChunk(Buffer.alloc(0), true);
    while (offset < size) {
      const len = Math.min(chunkBytes, size - offset);
      const buf = Buffer.alloc(len);
      await fd.read(buf, 0, len, offset);
      offset += len;
      await onChunk(buf, offset >= size);
    }
  } finally {
    await fd.close();
  }
}

export default { bundleOf, bundleByHash, readChunks };
