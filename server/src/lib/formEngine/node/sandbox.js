'use strict';
import vm from 'node:vm';

/**
 * Server-side evaluation of `runLocal` expressions and `evalDefault` defaults.
 *
 * MIRROR of client/src/lib/Helpers.js evalSandbox - the helper functions below are the
 * ones a runLocal expression can call in the browser (fnArray, fnGetNumberedName,
 * fnToTable, ...). Keep the two in sync.
 *
 * THREAT MODEL. The code evaluated here comes from the FORM DEFINITION, written by a
 * designer, never from the MCP caller. Field values supplied by the caller are spliced in
 * as JS literals (replacePlaceholderInString in 'expression' mode), so they cannot become
 * code. What this module guards against is a buggy or runaway expression, and code that
 * reaches for the host :
 *   - a fresh context per evaluation, holding only the JS builtins and the helpers below -
 *     no process, require, import, console, timers or network ;
 *   - codeGeneration.strings = false, so eval / Function / this.constructor.constructor
 *     cannot compile a string into code inside the context ;
 *   - no host object is ever passed in, so there is nothing to climb out through ;
 *   - a timeout (and microtaskMode afterEvaluate, so a promise chain cannot outlive it) ;
 *   - the result is copied out through JSON, so no context object reaches the caller.
 * node:vm is not a security boundary against hostile code in general (memory exhaustion is
 * not bounded, for one). Hostile code would need isolated-vm ; it is out of scope because
 * the code is the form author's.
 */

const PRELUDE = `
function fnToTable(data, { tableClass = '', escapeHtml = true, emptyCell = '', includeHeader = true } = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return '<table' + (tableClass ? ' class="' + tableClass + '"' : '') + '></table>';
  }
  const escape = escapeHtml
    ? (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    : (s) => String(s);
  const columns = [...new Set(data.flatMap(obj => Object.keys(obj)))];
  const thead = includeHeader
    ? '<thead><tr>' + columns.map(col => '<th>' + escape(col) + '</th>').join('') + '</tr></thead>'
    : '';
  const tbody = '<tbody>' + data.map(row =>
    '<tr>' + columns.map(col =>
      '<td>' + (row[col] === undefined || row[col] === null ? emptyCell : escape(row[col])) + '</td>'
    ).join('') + '</tr>'
  ).join('') + '</tbody>';
  return '<table' + (tableClass ? ' class="' + tableClass + '"' : '') + '>' + thead + tbody + '</table>';
}
function fnGetNumberedName(names, pattern, value, fillgap = false) {
  var nr = null;
  var re = new RegExp("[^#]*(#+)[^#]*");
  var patternmatch = re.exec(pattern);
  if (!names || !Array.isArray(names)) return value;
  if (patternmatch && patternmatch.length == 2) {
    var nrsequence = patternmatch[1];
    var regex = "^" + pattern.replace(nrsequence, "([0-9]{" + nrsequence.length + "})") + "$";
    var nrs = names.map((item) => {
      var regexp = new RegExp(regex, "g");
      var matches = regexp.exec(item);
      if (matches && matches.length == 2) return parseInt(matches[1]);
      return null;
    }).filter((item) => (item));
    var gaps = nrs.reduce(function (acc, cur, ind, arr) {
      var diff = cur - arr[ind - 1];
      if (diff > 1) {
        var i = 1;
        while (i < diff) { acc.push(arr[ind - 1] + i); i++; }
      }
      return acc;
    }, []);
    var max = (nrs.length > 0) ? Math.max(...nrs) : null;
    var gap = (gaps.length > 0) ? Math.min(...gaps) : null;
    if (max) nr = max + 1;
    if (fillgap && gap) nr = gap;
    if (nr) return pattern.replace(nrsequence, nr.toString().padStart(nrsequence.length, "0"));
    return value;
  }
  return value;
}
function matchRuleShort(str, rule) {
  var escapeRegex = (s) => s.replace(/([.*+?^=!:\${}()|\\[\\]\\/\\\\])/g, "\\\\$1");
  return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
}
function compareProps(x1, x2, p) {
  for (let i = 0; i < p.length; i++) {
    if (!matchRuleShort(x1[p[i]], x2[p[i]])) return false;
  }
  return true;
}
function comparePropsRegex(x1, x2, p) {
  for (let i = 0; i < p.length; i++) {
    if (!x1[p[i]].match(x2[p[i]])) return false;
  }
  return true;
}
function dynamicSort(property) {
  var sortOrder = 1;
  if (property[0] === "-") { sortOrder = -1; property = property.substr(1); }
  return function (a, b) {
    var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
    return result * sortOrder;
  };
}
function dynamicSortMultiple() {
  var props = arguments;
  return function (obj1, obj2) {
    var i = 0, result = 0, numberOfProperties = props.length;
    while (result === 0 && i < numberOfProperties) {
      result = dynamicSort(props[i])(obj1, obj2);
      i++;
    }
    return result;
  };
}
var fnArray = class fnArray extends Array {
  sortBy(...args) { return this.sort(dynamicSortMultiple(...args)); }
  distinctBy(...props) {
    return this.filter((item, index, arr) =>
      index === arr.findIndex(other => props.every(prop => item[prop] === other[prop])));
  }
  filterBy(...args) {
    let props = Object.keys(args[0]);
    return this.filter((x) => compareProps(x, args[0], props));
  }
  regexBy(...args) {
    let props = Object.keys(args[0]);
    return this.filter((x) => comparePropsRegex(x, args[0], props));
  }
  selectAttr(...args) {
    let props = Object.keys(args[0]);
    return this.map((x) => {
      let o = {};
      for (let i = 0; i < props.length; i++) o[props[i]] = x[args[0][props[i]]];
      return o;
    });
  }
};
`;

const preludeScript = new vm.Script(PRELUDE, { filename: 'formEngine-prelude.js' });

export const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Evaluate one runLocal expression.
 *
 * @param {string} expression  JS source, placeholders already substituted
 * @param {object} [opts]
 * @param {number} [opts.timeout]
 * @returns {*} a plain JSON value (undefined stays undefined)
 * @throws {Error} on a syntax error, a runtime error or the timeout
 */
export function evalSandbox(expression, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  if (!expression) return undefined;
  const context = vm.createContext(Object.create(null), {
    name: 'formEngine',
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: 'afterEvaluate',
  });
  preludeScript.runInContext(context, { timeout });
  // Compiled on the HOST side (codeGeneration only stops the context compiling strings).
  // A script's completion value is what eval() returns in the browser, so multi-statement
  // expressions behave the same.
  const result = new vm.Script(String(expression), { filename: 'runLocal.js' }).runInContext(context, { timeout });
  if (result === undefined) return undefined;
  // The copy out happens INSIDE the context : JSON.stringify there sees the result with
  // its own prototypes, and what crosses back is a primitive string.
  context.__result__ = result;
  const out = vm.runInContext('JSON.stringify(__result__)', context, { timeout });
  if (out === undefined) return undefined;
  return JSON.parse(out);
}

export default { evalSandbox, DEFAULT_TIMEOUT_MS };
