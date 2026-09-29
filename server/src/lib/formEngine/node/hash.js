'use strict';
import crypto from 'crypto';
import { canonicalJson } from '../output.js';

/**
 * Node-only half of the form engine : a stable hash of a payload, used by the MCP server to
 * tie a launch to the exact payload the user approved. Kept out of output.js so that file
 * stays importable in the browser.
 */
export function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export default { sha256 };
