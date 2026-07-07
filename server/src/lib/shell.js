// Shell escaping utilities.
// We intentionally keep using `child_process.exec` (which goes through /bin/sh -c)
// in several places because we depend on shell features like pipelines, redirection
// and env-var expansion. To stay safe, every value that originates from form data,
// user input, or any other untrusted source MUST be wrapped in `shellQuote()`
// before being concatenated into the command string.

/**
 * Wrap a value in POSIX-shell single quotes. Any embedded single quote is
 * replaced with the standard `'\''` sequence (close quote, escaped quote,
 * reopen quote), which is bulletproof against shell metacharacter injection.
 *
 * Example:
 *   shellQuote("a'; rm -rf / ; echo")
 *   -> "'a'\\''; rm -rf / ; echo'"
 *
 * The result is a single shell argv element regardless of the input's content.
 *
 * @param {*} value - any value; coerced to string via String().
 * @returns {string} shell-safe quoted token.
 */
export function shellQuote(value) {
  return `'${String(value ?? "").replace(/'/g, "'\\''")}'`;
}

export default { shellQuote };
