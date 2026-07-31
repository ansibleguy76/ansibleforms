'use strict';

import fn from './../functions/default.js';
import fnc from './../functions/custom.js';
// use as fn.xxxxx (where xxxxx is you own function name)

import logger from "../lib/logger.js";
//expression object create - not used, but you could create an instance with it
var Expression=function(){

};

function sanitizeExpression(expr){
  var sanitized=expr
  var message
  // first we check if the expression has errors
  if(sanitized.match(/\r|\n/)){
    message="Abuse attempt of eval function, attempt to have multilines"
    logger.error(message)
    // return "'ACCESS DENIED, no multiline expressions allowed'"
    throw Error(message)
  }
  // A BACKTICK is refused outright, before anything else looks at the string.
  //
  // The string strip below only handles " and ' - it never removed template literals, so a
  // backtick string survived into every later check as live code. Two holes came out of
  // that, both verified against the live endpoint:
  //   - `${fn.fnLs}` coerced the function to its SOURCE and returned it (info disclosure);
  //   - a TAGGED template is a call with no parenthesis, so ``(s=>s)`x` `` and ``[].concat`` ``
  //     invoked functions while the call check below - which only looks for `(` - saw
  //     nothing, defeating the "every call must be fn./fnc." rule this sanitizer exists to
  //     enforce.
  // Template literals are not part of the documented expression syntax (fn.<name>(...),
  // arithmetic and string operations with " or '), so refusing them loses nothing and
  // closes the whole class rather than one shape of it. Same tier as the `;` / newline
  // rejections above.
  if(sanitized.match(/`/)){
    message="Abuse attempt of eval function, template literals are not allowed, try runLocal"
    logger.error(message)
    throw Error(message)
  }
  // then we remove all harmless strings
  sanitized = sanitized.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g,"")
  // we check if ";" is present, no multi commands
  if(sanitized.match(/;/)){
    message="Abuse attempt of eval function, attempt to have multi expression, try runLocal"
    logger.error(message)
    // return "'ACCESS DENIED, no multiple expressions allowed'"
    throw Error(message)
  }
  // if contains process.env
  if(sanitized.match(/process\.env/)){
    message="Abuse attempt of eval function, attempt to get environment variables"
    logger.error(message)
    // return "'ACCESS DENIED, no access to environment variables (process.env)'"
    throw Error(message)
  }
  // EVERY call must be an fn./fnc. call - not merely the first thing in the expression.
  //
  // This used to test `/^fnc{0,1}\.+/`, i.e. how the expression STARTS. Two failures came
  // out of that: `fn.upper['constructor']('return 1')()` starts with `fn.` and so passed,
  // and perfectly legitimate expressions were refused for cosmetic reasons - a leading
  // space, or starting with a string literal (`'x' + fn.upper('a')`), because the string
  // strip above runs first and the test was never trimmed.
  //
  // Blank out the legitimate call heads, then refuse anything that still looks like a
  // call: an open parenthesis directly after an identifier, a `]` or a `)`. Grouping
  // parentheses in arithmetic are preceded by an operator or nothing, so they survive.
  const callsRemoved = sanitized.replace(/\bfnc?\.[A-Za-z0-9_$]+\s*\(/g, "(")
  if(callsRemoved.match(/[A-Za-z0-9_$\])]\s*\(/)){
    message="Abuse attempt of eval function, using custom functions, try runLocal"
    logger.error(message)
    throw Error(message)
  }
  // The check above only asks how the expression STARTS. Once it began with `fn.`, every
  // parenthesis after that was allowed anywhere - so `fn.env || import('node:child_process')
  // .then(m => m.execSync('id'))` passed and ran as the server user. These identifiers are
  // the ways out of an eval, and no legitimate expression needs one: the documented use is
  // `fn.<name>(...)`, arithmetic and string operations.
  //
  // This is a tighter blacklist, not a sandbox - eval is still eval. Treat the endpoint as
  // privileged and prefer runLocal for anything that does not need the server.
  // Quoted strings were stripped above, so a literal like "import a licence" is unaffected.
  const FORBIDDEN = /\b(import|require|process|globalThis|global|constructor|__proto__|prototype|Function|eval|Reflect|Proxy|Buffer|module|exports|child_process|fetch|XMLHttpRequest)\b/
  const banned = sanitized.match(FORBIDDEN)
  if(banned){
    message=`Abuse attempt of eval function, '${banned[0]}' is not allowed in a server expression, try runLocal`
    logger.error(message)
    throw Error(message)
  }
  // A property reached by STRING KEY is invisible to the check above, because the string
  // strip runs first: `fn.upper['constructor']('return 1')()` left `fn.upper[]()()`, which
  // matches nothing forbidden - and the ORIGINAL expression is what gets evaluated. So the
  // bracket keys are checked separately, against the untouched text. This is the one place
  // a quoted string must be read rather than discarded; data strings elsewhere stay
  // unaffected, so `fn.echo('please import the licence')` still works.
  for (const m of expr.matchAll(/\[\s*(["'])((?:\\.|(?!\1).)*)\1\s*\]/g)) {
    const key = m[2]
    if (FORBIDDEN.test(key)) {
      message=`Abuse attempt of eval function, '${key}' is not allowed as a property name in a server expression, try runLocal`
      logger.error(message)
      throw Error(message)
    }
  }
  return expr
}
async function doAsync (expr) {
    var sanitized = sanitizeExpression(expr)
    // fn and fnc are resolved by name inside eval(), they must stay named as-is
    // eslint-disable-next-line no-unused-vars
    return await (function(fn, fnc) {
      return eval(sanitized);
    })(fn, fnc);
}
// execute expression (cannot be a promise)
Expression.execute = function (expr,noLog) {
  if(noLog){
    logger.info('Expression: noLog is applied')
  }else{
    logger.info(`Expression: ${expr}`)
  }
  return doAsync(expr)
};


export default Expression;
