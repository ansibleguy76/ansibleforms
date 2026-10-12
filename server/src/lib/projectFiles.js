// The designer's Playbooks and Vars files sections : the pure rules of their file API (which
// paths a request may name, what counts as a text file). Kept free of database and file
// access so they can be unit tested (tests/project-files.test.mjs).
import path from "path";

// the folders the sections browse : the playbooks (the playbooks repository, else ANSIBLE_PATH),
// the vars files (a forms repository's vars folder, else VARS_FILES_PATH) and the inventories
// (the inventories repositories, else INVENTORY_PATH)
export const FILE_KINDS = ["playbooks", "vars", "inventories"];

// the largest file the designer opens or saves : an editor is no place for anything bigger
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

// a listing stops here : a folder this big is not one to browse in the designer
export const MAX_LISTED_FILES = 5000;

// one path segment : letters, digits and the usual punctuation of file names - never a
// hidden one (.git, .env) and never . or ..
const SEGMENT = /^[\p{L}\p{N}_@+=,~-][\p{L}\p{N} _.@+=,~-]*$/u;

/**
 * The path a request names, made safe : relative, forward slashes, no hidden segment, no
 * way out of its folder.
 *
 * Args:
 *   rel (string): the path as the request gives it (relative to the section's folder).
 *
 * Returns:
 *   string: the path, normalized (a/b/c.yml).
 *
 * Raises:
 *   Error: the path is empty, absolute, too long, or has a segment that is not allowed.
 */
export function safeRelativePath(rel) {
  if (typeof rel !== "string") throw new Error("A file path is required");
  const trimmed = rel.trim().replace(/^\/+/, "");
  if (!trimmed) throw new Error("A file path is required");
  if (trimmed.length > 512) throw new Error("The file path is too long");
  if (trimmed.includes("\\") || trimmed.includes("\0")) throw new Error(`'${rel}' is not a valid file path`);
  const segments = trimmed.split("/").filter((s) => s !== "");
  for (const s of segments) {
    if (s.length > 255 || !SEGMENT.test(s)) throw new Error(`'${rel}' is not a valid file path`);
  }
  return segments.join("/");
}

/**
 * Whether an absolute path lies inside a folder (the folder itself excluded).
 *
 * Args:
 *   root (string): the folder, absolute.
 *   target (string): the path, absolute.
 *
 * Returns:
 *   boolean: true when target is below root.
 */
export function isInside(root, target) {
  const rel = path.relative(root, target);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Whether a file's bytes are text : no NUL byte in its first 8000 bytes (git's own test).
 *
 * Args:
 *   buffer (Buffer): the file's content.
 *
 * Returns:
 *   boolean: true for a text file.
 */
export function isTextBuffer(buffer) {
  return !buffer.subarray(0, 8000).includes(0);
}
