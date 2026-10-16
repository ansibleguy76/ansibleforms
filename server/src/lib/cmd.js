import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { parse } from 'shell-quote';
import config from '../../config/app.config.js';
import logger from './logger.js';
var Cmd = function(){

}

/**
 * Stops a command and every process it started : it runs detached, in a process group of its
 * own (executeSilentCommand), so the whole group gets the signal.
 *
 * Args:
 *   pid (number): the command's process id.
 */
Cmd.killChildren = (pid) => {
  // Defensive: pid must be numeric. Anything else is an injection attempt or a programming bug.
  const numericPid = parseInt(pid, 10);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    logger.warning(`Cmd.killChildren: refusing non-numeric pid ${JSON.stringify(pid)}`);
    return;
  }
  try {
    process.kill(-numericPid, 'SIGTERM');
  } catch (e) {
    // not a group leader (or gone already) : the process itself
    try {
      process.kill(numericPid, 'SIGTERM');
    } catch (e2) {
      logger.debug(`Cmd.killChildren: process.kill failed for pid ${numericPid}: ${e2.message}`);
    }
  }
};

/**
 * Text with the user and password of every address in it masked : git writes the address it
 * was given in its errors (fatal: unable to access 'https://user:token@host/...'), so a
 * repository's token would reach the log, the job output and the error otherwise.
 *
 * Args:
 *   text (string): a command's output.
 *
 * Returns:
 *   string: the text, every scheme://user:password@ written scheme://user:*******@.
 */
Cmd.maskUrlCredentials = (text) => String(text ?? "").replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:@/]+):[^\s@]+@/gi, "$1:*******@");

/**
 * A command as the program and its arguments, read as a shell would split it but never run by
 * one : quotes and backslashes group and escape as in sh, a $NAME of `env` is put in its place
 * (any other stays as it is written), and a shell operator (; | & && || > < and the like) is
 * refused, since nothing would carry it out.
 *
 * Args:
 *   command (string): the command line (a configured one, GIT_PULL_COMMAND, may have options).
 *   env (object): the variables a $NAME may name.
 *
 * Returns:
 *   string[]: the program, then its arguments.
 *
 * Raises:
 *   Error: an empty command, or one with a shell operator.
 */
Cmd.splitCommand = (command, env = {}) => {
  const words = parse(String(command ?? ""), (key) => (Object.prototype.hasOwnProperty.call(env, key) ? env[key] : "$" + key));
  const argv = words.map((w) => {
    if (typeof w === "string") return w;
    if (w && w.op === "glob") return w.pattern;
    throw new Error(`The command '${command}' uses the shell operator '${w?.op ?? w?.comment ?? "?"}' : commands run without a shell, give the program and its arguments only`);
  });
  if (!argv.length || !argv[0]) throw new Error("No command given");
  return argv;
};

/**
 * Starts a program with its arguments, without a shell : its output is the caller's to read.
 *
 * Args:
 *   file (string): the program.
 *   args (string[]): its arguments.
 *
 * Returns:
 *   ChildProcess: the running program.
 */
Cmd.runCommand = (file, args = []) => {
  return spawn(file, args, { stdio: ["ignore", "pipe", "pipe"] });
};

/**
 * Runs a command and gives its output, never through a shell (an argument can not become a
 * second command). Its output is masked (an address's password) before it is kept.
 *
 * Args:
 *   cmd (object): what to run :
 *     command (string): the command line, split by Cmd.splitCommand ; its $NAMEs from env.
 *     directory (string): where it runs.
 *     description (string): for the log.
 *     maskedCommand (string): the command as it is logged and shown, when the command itself
 *       must not be (none : the command as written, its $NAMEs not filled in).
 *     env (object): variables added to its environment (and its $NAMEs).
 *     stdinFile (string): a file its input is read from (the shell's < file).
 *     stdoutFile (string): a file its output is written to instead of being kept (the shell's
 *       > file).
 *   silent (boolean): not logged as a notice.
 *   singleLine (boolean): only its first line, and no "Running command" line.
 *   timeoutSeconds (number): stopped after this long.
 *
 * Returns:
 *   Promise<string>: its output.
 *
 * Raises:
 *   Error: it could not start, ended with another code than 0, or ran out of time ; the message
 *     is its output.
 */
/**
 * The folder a command runs in, when it is one a command may run in : the server's own folder, or
 * one in the repositories folder (a clone). Anything else is refused, whatever a caller passes.
 *
 * Args:
 *   directory (string): the folder asked for.
 *
 * Returns:
 *   string: the folder, resolved.
 *
 * Raises:
 *   Error: a folder outside those.
 */
Cmd.workingFolder = (directory) => {
  const resolved = path.resolve(String(directory || process.cwd()));
  const roots = [process.cwd(), config.repoPath].filter(Boolean).map((r) => path.resolve(r));
  if (roots.some((root) => resolved === root || resolved.startsWith(root + path.sep))) return resolved;
  throw new Error(`A command can not run in '${resolved}': only in the server's folder or a repository's`);
};

Cmd.executeSilentCommand = async (cmd,silent=false,singleLine=false,timeoutSeconds=60) => {
  return new Promise((resolve,reject)=>{
    try{
      var directory = Cmd.workingFolder(cmd.directory)
      var description = cmd.description
      var env = cmd.env || {}
      var maskedCommand = cmd.maskedCommand || cmd.command
      logger.debug(`${description}, ${directory} > ${maskedCommand}`)
      var [basecmd, ...parameters] = Cmd.splitCommand(cmd.command, env)
      var out=[]
      if(!singleLine){
        out.push(`Running command: ${maskedCommand}`)
      }
      if(!silent){
        logger.notice(`Running command: ${maskedCommand}`)
      }
      // detached : in a process group of its own, so a timeout stops it and what it started
      var child = spawn(basecmd,parameters,{stdio:[cmd.stdinFile ? "pipe" : "ignore","pipe","pipe"],cwd:directory,detached:true,env:{...process.env,...env}});
      var timeout = setTimeout(()=>{
        Cmd.killChildren(child.pid)
      },timeoutSeconds*1000)
      if (cmd.stdinFile) {
        const input = fs.createReadStream(cmd.stdinFile)
        input.on("error", (e) => { out.push(e.message); child.stdin.destroy() })
        child.stdin.on("error", () => {})
        input.pipe(child.stdin)
      }
      var written = null
      if (cmd.stdoutFile) {
        written = fs.createWriteStream(cmd.stdoutFile)
        child.stdout.pipe(written)
      } else {
        child.stdout.on('data',function(data){
          out.push(Cmd.maskUrlCredentials(data.toString()))
        })
      }
      child.stderr.on('data',function(data){
        out.push(Cmd.maskUrlCredentials(data.toString()))
      })
      var started = true
      // 'close', not 'exit' : 'exit' can fire before the output is read, and a quick command
      // (git status) then resolves with no output at all
      child.on('close',async function(code){
        clearTimeout(timeout)
        if (!started) return
        // the file it wrote is complete before anyone reads it
        if (written) await new Promise((r) => written.end(r))
        logger.info(description + " finished: " + code)
        out = out.map((line)=>{
          return line.replace(/\n+$/g,'').replace(/\r\n/g,'')
        })
        out.push("")
        if(code!==0){
          if(child.signalCode=='SIGTERM'){
            out.push("The command timed out")
          }
          reject(new Error(singleLine ? out[0] : out.join("\n")))
          return
        }
        resolve(singleLine ? out[0] : out.join('\n'))
      })
      // it could not start (the program is not installed, the folder does not exist)
      child.on('error',function(data){
        started = false
        clearTimeout(timeout)
        if (data?.code === "ENOENT") out.push(`'${basecmd}' was not found, or the folder '${directory}' does not exist`)
        else out.push(Cmd.maskUrlCredentials(data.toString()))
        reject(new Error(out.join('\n')))
      })
    }catch(e){
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })

}

/**
 * Whether a program is on the PATH (what `command -v` answers in a shell).
 *
 * Args:
 *   binary (string): the program, by name or by path.
 *
 * Returns:
 *   boolean: true when it exists and can be run.
 */
Cmd.isAvailable = (binary) => {
  const name = String(binary || "");
  if (!name) return false;
  const runnable = (file) => {
    try {
      fs.accessSync(file, fs.constants.X_OK);
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  };
  if (name.includes("/")) return runnable(name);
  return String(process.env.PATH || "").split(path.delimiter).filter(Boolean).some((dir) => runnable(path.join(dir, name)));
};

export default Cmd
