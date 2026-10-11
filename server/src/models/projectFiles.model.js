'use strict';
// The designer's Playbooks and Vars files sections : the files of the playbooks folder and of
// the vars files folder - the playbooks repository's (use_for_playbooks), the vars folder of the
// forms repository - or the local folder (ANSIBLE_PATH, VARS_FILES_PATH). Listed, read, written and deleted
// here ; a repository's are then pushed to its remote (Push, as the forms' Save to repo).
import fs from "fs";
import path from "path";
import logger from "../lib/logger.js";
import Errors from "../lib/errors.js";
import appConfig from "../../config/app.config.js";
import ansibleConfig from "../../config/ansible.config.js";
import Repository from "./repository.model.js";
import Repo from "./repo.model.js";
import { configRepoFromPath } from "../lib/forms-git.js";
import { FILE_KINDS, MAX_FILE_BYTES, MAX_LISTED_FILES, safeRelativePath, isInside, isTextBuffer } from "../lib/projectFiles.js";

const ProjectFiles = {};

/**
 * The folder of a kind of files and the repository it belongs to.
 *
 * Args:
 *   kind (string): 'playbooks' or 'vars'.
 *
 * Returns:
 *   object: { root (absolute folder), repository (its name, or null for a local folder) }.
 *
 * Raises:
 *   BadRequestError: the kind is not one of FILE_KINDS.
 */
ProjectFiles.location = async function (kind) {
  if (!FILE_KINDS.includes(kind)) throw new Errors.BadRequestError(`Unknown kind of files '${kind}'`);
  const root = kind === "playbooks"
    ? (await Repository.getAnsiblePath()) || ansibleConfig.path
    : await Repository.getVarsFilesPath();
  return { root: path.resolve(root), repository: configRepoFromPath(path.resolve(root), path.resolve(appConfig.repoPath)) };
};

/**
 * The absolute path of a file of a kind, refused when it would leave its folder (a '..' or a
 * link pointing out of it).
 *
 * Args:
 *   root (string): the kind's folder.
 *   rel (string): the file's path, relative to it.
 *
 * Returns:
 *   object: { rel (normalized), abs (absolute) }.
 *
 * Raises:
 *   BadRequestError: the path is not valid, or leads out of the folder.
 */
async function resolveIn(root, rel) {
  let safe;
  try {
    safe = safeRelativePath(rel);
  } catch (e) {
    throw new Errors.BadRequestError(e.message);
  }
  const abs = path.resolve(root, safe);
  if (!isInside(root, abs)) throw new Errors.BadRequestError(`'${rel}' is not a valid file path`);
  // the deepest part that exists, as the disk resolves it (links followed), stays inside too
  const realRoot = await fs.promises.realpath(root).catch(() => root);
  let probe = abs;
  while (probe !== root && !fs.existsSync(probe)) probe = path.dirname(probe);
  if (probe !== root) {
    const real = await fs.promises.realpath(probe);
    if (real !== realRoot && !isInside(realRoot, real)) throw new Errors.BadRequestError(`'${rel}' is not a valid file path`);
  }
  return { rel: safe, abs };
}

/**
 * The files of a kind : every file below its folder (hidden ones and links left out), with
 * whether its repository has changes not pushed yet.
 *
 * Args:
 *   kind (string): 'playbooks' or 'vars'.
 *
 * Returns:
 *   object: { repository, exists (the folder is there), truncated (more than MAX_LISTED_FILES),
 *     dirty (the repository has changes to push), files: [{ path, size, modified }] }.
 */
ProjectFiles.list = async function (kind) {
  const { root, repository } = await ProjectFiles.location(kind);
  const files = [];
  let truncated = false;
  const exists = fs.existsSync(root);
  // breadth first, one folder at a time, at most 12 deep
  const walk = async (dir, rel, depth) => {
    if (depth > 12 || truncated) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      logger.warning(`Cannot list ${dir} : ${e.message}`);
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const childAbs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(childAbs, childRel, depth + 1);
      } else if (entry.isFile()) {
        if (files.length >= MAX_LISTED_FILES) {
          truncated = true;
          return;
        }
        const stat = await fs.promises.stat(childAbs);
        files.push({ path: childRel, size: stat.size, modified: stat.mtime });
      }
    }
  };
  if (exists) await walk(root, "", 0);
  let dirty = false;
  if (repository && exists) {
    try {
      dirty = await Repo.hasChanges(repository);
    } catch (e) {
      logger.warning(`Cannot tell whether '${repository}' has changes : ${e.message}`);
    }
  }
  return { repository, exists, truncated, dirty, files };
};

/**
 * A file's content.
 *
 * Args:
 *   kind (string): 'playbooks' or 'vars'.
 *   rel (string): the file's path in its folder.
 *
 * Returns:
 *   object: { path, content }.
 *
 * Raises:
 *   NotFoundError: there is no such file.
 *   BadRequestError: the path is not valid, the file is too big or not text.
 */
ProjectFiles.read = async function (kind, rel) {
  const { root } = await ProjectFiles.location(kind);
  const file = await resolveIn(root, rel);
  const stat = await fs.promises.stat(file.abs).catch(() => null);
  if (!stat || !stat.isFile()) throw new Errors.NotFoundError(`File '${file.rel}' not found`);
  if (stat.size > MAX_FILE_BYTES) throw new Errors.BadRequestError(`File '${file.rel}' is too big to edit here`);
  const buffer = await fs.promises.readFile(file.abs);
  if (!isTextBuffer(buffer)) throw new Errors.BadRequestError(`File '${file.rel}' is not a text file`);
  return { path: file.rel, content: buffer.toString("utf8") };
};

/**
 * Runs a write in a kind's folder : in a repository, while holding its claim (no pull, sync or
 * clone runs on the same working tree meanwhile).
 */
async function withWriteClaim(repository, write) {
  const prior = repository ? await Repository.claimForWrite(repository) : undefined;
  try {
    return await write();
  } finally {
    if (repository && prior !== undefined) await Repository.releaseWrite(repository, prior);
  }
}

/**
 * Writes a file (a new one, or over the one there), its folders made as needed.
 *
 * Args:
 *   kind (string): 'playbooks' or 'vars'.
 *   rel (string): the file's path in its folder.
 *   content (string): its text.
 *   onlyNew (boolean): refuse when the file is there already (a new file, not a save).
 *
 * Returns:
 *   object: { path, repository }.
 *
 * Raises:
 *   BadRequestError: the path or the content is not valid.
 *   ConflictError: onlyNew and the file exists.
 */
ProjectFiles.write = async function (kind, rel, content, onlyNew = false) {
  if (typeof content !== "string") throw new Errors.BadRequestError("The content must be text");
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) throw new Errors.BadRequestError("The content is too big to save here");
  const { root, repository } = await ProjectFiles.location(kind);
  const file = await resolveIn(root, rel);
  return withWriteClaim(repository, async () => {
    if (fs.existsSync(file.abs)) {
      if (onlyNew) throw new Errors.ConflictError(`File '${file.rel}' exists already`);
      if (!(await fs.promises.stat(file.abs)).isFile()) throw new Errors.BadRequestError(`'${file.rel}' is not a file`);
    }
    await fs.promises.mkdir(path.dirname(file.abs), { recursive: true });
    await fs.promises.writeFile(file.abs, content, "utf8");
    logger.notice(`Saved ${kind} file ${file.rel}${repository ? ` in repository '${repository}'` : ""}`);
    return { path: file.rel, repository };
  });
};

/**
 * Deletes a file, and the folders it leaves empty.
 *
 * Args:
 *   kind (string): 'playbooks' or 'vars'.
 *   rel (string): the file's path in its folder.
 *
 * Returns:
 *   object: { path, repository }.
 *
 * Raises:
 *   NotFoundError: there is no such file.
 */
ProjectFiles.remove = async function (kind, rel) {
  const { root, repository } = await ProjectFiles.location(kind);
  const file = await resolveIn(root, rel);
  return withWriteClaim(repository, async () => {
    const stat = await fs.promises.lstat(file.abs).catch(() => null);
    if (!stat || !stat.isFile()) throw new Errors.NotFoundError(`File '${file.rel}' not found`);
    await fs.promises.unlink(file.abs);
    let dir = path.dirname(file.abs);
    while (dir !== root && isInside(root, dir) && (await fs.promises.readdir(dir)).length === 0) {
      await fs.promises.rmdir(dir);
      dir = path.dirname(dir);
    }
    logger.notice(`Deleted ${kind} file ${file.rel}${repository ? ` in repository '${repository}'` : ""}`);
    return { path: file.rel, repository };
  });
};

/**
 * Commits and pushes the changes of a kind's repository.
 *
 * Args:
 *   kind (string): 'playbooks' or 'vars'.
 *   username (string): who pushes (in the commit message).
 *
 * Returns:
 *   object: { repository, output }.
 *
 * Raises:
 *   BadRequestError: the kind's files are in a local folder, not a repository.
 */
ProjectFiles.push = async function (kind, username) {
  const { repository } = await ProjectFiles.location(kind);
  if (!repository) throw new Errors.BadRequestError("These files are in a local folder : there is no repository to push to");
  const what = kind === "playbooks" ? "Playbooks" : "Vars files";
  const output = await Repository.sync(repository, username, `${what} sync by ${username || "AnsibleForms"}`);
  return { repository, output };
};

export default ProjectFiles;
