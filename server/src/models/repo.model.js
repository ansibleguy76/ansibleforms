'use strict';
import Cmd from "../lib/cmd.js";
import logger from "../lib/logger.js";
import path from "path";
import fs from "fs";
import config from '../../config/app.config.js';
import quote from 'shell-quote/quote.js'; // shell-escape values interpolated into commands (Cmd runs with shell:true)

const SAFE_NAME_REGEX = /^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/;
const SAFE_BRANCH_REGEX = /^[a-zA-Z0-9_][a-zA-Z0-9._\-/]*$/;
const SAFE_URI_REGEX = /^(https?:\/\/|git:\/\/|ssh:\/\/|[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+:)/;
const SAFE_HOST_REGEX = /^[a-zA-Z0-9._-]+$/;

function validateRepoName(name) {
  if (!name || typeof name !== 'string' || !SAFE_NAME_REGEX.test(name) || name.includes('..')) {
    throw new Error(`Invalid repository name: ${name}. Only alphanumeric characters, hyphens, underscores, and dots are allowed.`);
  }
}

function validateBranch(branch) {
  if (!branch || typeof branch !== 'string' || !SAFE_BRANCH_REGEX.test(branch) || branch.includes('..')) {
    throw new Error(`Invalid branch name: ${branch}. Only alphanumeric characters, hyphens, underscores, dots, and slashes are allowed.`);
  }
}

function validateUri(uri) {
  if (!uri || typeof uri !== 'string' || !SAFE_URI_REGEX.test(uri)) {
    throw new Error(`Invalid repository URI. URI must start with http://, https://, git://, ssh://, or be an SSH-style path (user@host:path).`);
  }
  if (/[;|&$`\\!(){}[\]<>\n\r]/.test(uri.replace(/https?:\/\/[^@]*@/, ''))) {
    throw new Error(`Repository URI contains invalid characters.`);
  }
}

function validateHostname(host) {
  if (!host || typeof host !== 'string' || !SAFE_HOST_REGEX.test(host)) {
    throw new Error(`Invalid hostname: ${host}. Only alphanumeric characters, dots, hyphens, and underscores are allowed.`);
  }
}

const Repo={

}

Repo.maskGitToken =(data)=>{
  if(data){
    try{
      // console.log(data.toString())
      var masked = data.toString().replace(/(http[s]{0,1}):\/\/([^:]+):([^@]+)@(.*)/gm,"$1://$2:*******@$4")
      // console.log("==> " + rep)
      return masked
    }catch(e){
      logger.error("Failed to maskGitToken : ",e)
      return data
    }
  }else{
    return data
  }
}

Repo.color = function(t){
  return ([].concat(t)).map(x=> x.replace(/^([^:\n\r]+:)/gm,"<strong class='has-text-info'>$1</strong>")).join("\r\n")
}

/**
 * Move a repository's working tree when the record is renamed.
 *
 * `name` is an editable field and the tree lives at repoPath/<name>, so renaming the row
 * alone orphaned the clone: the renamed repository had no working tree at all and every
 * pull answered "not cloned yet", while the old directory stayed behind. Both names are
 * validated because both become path segments.
 *
 * A repository whose clone never ran has no directory, which is not an error - there is
 * simply nothing to move.
 *
 * @returns {boolean} whether a directory was actually moved. The caller needs this to
 *   know if it has anything to undo when the database write that follows fails: reversing
 *   a move that never happened would be a second no-op at best, and misleading at worst.
 */
Repo.rename = function (oldName, newName) {
    validateRepoName(oldName);
    validateRepoName(newName);
    const directory = config.repoPath;
    const from = path.join(directory, oldName);
    const to = path.join(directory, newName);
    if (!fs.existsSync(from)) {
        logger.notice(`Repository '${oldName}' has no working tree to move`);
        return false;
    }
    if (fs.existsSync(to)) {
        throw new Error(`Cannot rename repository to '${newName}': a working tree already exists at that name`);
    }
    logger.notice(`Moving repository working tree ${oldName} -> ${newName}`);
    fs.renameSync(from, to);
    return true;
};

Repo.delete = async function (name) {
    validateRepoName(name);
    logger.notice("Deleting repository " + name)
    var directory = config.repoPath

    // A repository whose clone never succeeded has no directory on disk. accessSync
    // threw ENOENT for exactly that case, and since Repository.delete does not await
    // this it surfaced as an unhandled rejection while the record was removed anyway.
    // rmSync with force is already a no-op on a missing path, so the check was pure
    // downside.
    fs.rmSync(path.join(directory,name),{force:true,recursive:true})
    return

}

// run git clone
Repo.info = async function (name) {

    validateRepoName(name);
    // logger.notice(`Git repository info : ${name}`)
    var directory = path.join(config.repoPath,name)

    var cmd
    if(name){
      cmd = `git rev-parse --short HEAD`
    }else{
      throw new Error("No name given")
    }
    return await Cmd.executeSilentCommand({command:cmd,directory:directory,description:"Getting repository info"},true,true)

};

// run git clone
Repo.clone = async function (uri,name,branch=undefined) {

    validateRepoName(name);
    validateUri(uri);
    if (branch) {
      validateBranch(branch);
    }

    var directory = config.repoPath
    var exists = true
    try{
      fs.accessSync(path.join(directory,name))
    }catch(e){
      exists=false
    }
    if(exists){
      logger.notice("Repository already exists, pulling instead")
      return await Repo.pull(name)
    }else{
      logger.notice(`Cloning repository : ${Repo.maskGitToken(uri)}`)
      try{
        fs.accessSync(config.repoPath)
      }catch(e){
        try{
          logger.notice("Force creating path : " + directory)
          fs.mkdirSync(directory, { recursive: true,force:true });
        }catch(err){
          logger.error("Failed to create the path : ", err)
          throw err
        }
      }

      var cmd
      if(uri){
        if(branch){
          cmd = `${config.gitCloneCommand} -b ${quote([branch])} --verbose ${quote([uri])} ${quote([name])}`
        }else{
          cmd = `${config.gitCloneCommand} --verbose ${quote([uri])} ${quote([name])}`
        }
      }else{
        throw new Error("No uri given")
      }

      var hostRegex = new RegExp(".*@([^:]+):.*", "g");

      // extract the ssh host from the RAW uri (not the shell-escaped command,
      // where the escaping would corrupt the captured host) e.g. git@host:repo
      var match = hostRegex.exec(uri);
      if(match && uri){
        var host = match[1]
        validateHostname(host);
        logger.notice(`Found host in command : ${host}; adding it to known_hosts`)
        cmd = `ssh-keyscan ${quote([host])} >> ~/.ssh/known_hosts ; ${cmd}`
      }else{
        logger.warning(`No host found in command`)
      }
      var maskedCommand = Repo.maskGitToken(cmd)
      return await Cmd.executeSilentCommand({command:cmd,directory:directory,description:"Cloning repository",maskedCommand:maskedCommand})

    }
};
// add ssh known hosts
/**
 * Add the host keys for `hosts` to ~/.ssh/known_hosts.
 *
 * A PROMISE, deliberately. This used to register listeners and fall off the end, so the
 * async function resolved `undefined` before ssh-keyscan had run - the `return` on the
 * success branch returned from the 'exit' LISTENER, where nothing reads it, so a caller's
 * `await` never saw success or failure. Worse, the failure branch threw from inside that
 * listener: there is no frame above a child-process event handler, so it was an uncaught
 * exception that would terminate the server. `ssh-keyscan ... >> ~/.ssh/known_hosts`
 * exits non-zero whenever ~/.ssh does not exist or ssh-keyscan is not installed, so that
 * was not a remote possibility.
 *
 * Nothing calls this today - knownhosts.model.js has its own promisified implementation -
 * but it is exported, so the first caller added would have crashed the process.
 */
// Stays `async` on purpose: validateHostname below throws SYNCHRONOUSLY, and callers
// (and tests/repo-integration.test.js) expect a rejected promise, not a thrown error.
Repo.addKnownHosts = async function (hosts) {
    if(!hosts){
      throw new Error("No hosts given")
    }
    var hostList = hosts.split(/[\s,]+/).filter(Boolean);
    hostList.forEach(function(h) {
      validateHostname(h);
    });
    logger.notice(`Adding keys for hosts ${hosts}`)
    var safeHosts = hostList.map(h => quote([h])).join(' ')
    var cmd = `ssh-keyscan ${safeHosts} >> ~/.ssh/known_hosts`
    logger.notice(`Running cmd : ${cmd}`)
    return new Promise((resolve, reject) => {
      var known_hosts = Cmd.runCommand(cmd)
      var output = []
      known_hosts.stdout.on('data', function(a){
        logger.info(a)
        output.push(a)
      });
      known_hosts.stderr.on('data', function(a){
        output.push(a)
        logger.error('stderr:'+a);
      });
      // spawn/exec can fail before the process exists (ENOENT); without this the promise
      // would never settle and the caller would hang for ever
      known_hosts.on('error', function(e){
        reject(new Error(`Adding keys failed to start : ${e.message}`))
      });
      known_hosts.on('exit', function(code){
        logger.debug('exit')
        if(code==0){
          resolve(`Adding keys ran succesfully\n${output.join("\n")}`)
        }else{
          reject(new Error(`\nAdding keys failed with code ${code}\n${output.join("\n")}`))
        }
      });
    });
};


// run a playbook
Repo.pull = async function (name) {
      validateRepoName(name);
      var command = `${config.gitPullCommand} --verbose`
      var directory = path.join(config.repoPath,name)
      return await Cmd.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"},true)
};

// does the working tree have uncommitted changes, or local commits not yet
// pushed to the remote ? (issue #414, used to flag unpushed designer work)
Repo.hasChanges = async function (name) {
    const directory = path.join(config.repoPath, name)
    const clean = (out) => String(out).split("\n").filter(l => l.trim() && !l.startsWith("Running command"))
    // `git status` is the FACT this function exists to establish, so it is not in the
    // catch. It used to be: any failure - the tree not cloned, the 60s command timeout,
    // a stale index.lock, git missing from PATH - was answered as "no local changes".
    // That is the one answer that must never be invented here, because cron.service
    // guards the scheduled pull with `else if (await hasLocalChanges(name))`: a false
    // `false` skips the guard and runs `git pull` over a working tree the designer has
    // uncommitted work in, which is exactly the race it was added for (issue #414). It
    // also made the settings page report a dirty repository as clean.
    const dirty = await Cmd.executeSilentCommand({ directory, command: "git status --porcelain", description: "Checking status" }, true)
    if (clean(dirty).length > 0) return true
    try {
      // count commits ahead of the upstream. THIS one is genuinely allowed to fail: a
      // branch with no upstream makes `@{u}` an error, and that means "nothing to push".
      const ahead = await Cmd.executeSilentCommand({ directory, command: "git rev-list --count @{u}..HEAD", description: "Checking ahead" }, true)
      return parseInt(clean(ahead)[0] || "0", 10) > 0
    } catch (e) {
      return false
    }
};

// commit local changes and push them, with a fetch/rebase/push retry loop
// (issue #414) ; on a persistent conflict the rebase is aborted and the
// conflicted files are reported in the error
Repo.sync = async function (name, message) {
    const directory = path.join(config.repoPath, name)
    const out = []
    const attempts = 5

    // commits are made as the application, the triggering user is part of the
    // message ; shell-escape it (the username is user-controlled, no injection)
    const safeMessage = quote([message || "AnsibleForms forms sync"])
    const gitCommit = `git -c user.name="AnsibleForms" -c user.email="ansibleforms@localhost" commit -m ${safeMessage}`

    // stage everything (the working tree of a forms repo is fully managed by AnsibleForms)
    out.push(await Cmd.executeSilentCommand({ command: "git add -A", directory, description: "Staging changes" }, true))

    // commit ; "nothing to commit" is not an error, the push may still be needed
    try {
      out.push(await Cmd.executeSilentCommand({ command: gitCommit, directory, description: "Committing changes" }, true))
    } catch (e) {
      if (/nothing (added )?to commit|working tree clean/i.test(e.message)) {
        out.push("Nothing new to commit")
      } else {
        throw e
      }
    }

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        out.push(await Cmd.executeSilentCommand({ command: "git fetch origin", directory, description: "Fetching from git" }, true))
        try {
          // the identity is needed here too : a rebase rewrites the local commits
          out.push(await Cmd.executeSilentCommand({ command: `git -c user.name="AnsibleForms" -c user.email="ansibleforms@localhost" pull --rebase`, directory, description: "Rebasing on remote" }, true))
        } catch (e) {
          // a clone of an empty repository has no upstream yet ; nothing to rebase on
          if (/couldn't find remote ref|no such ref was fetched|no tracking information|unknown revision/i.test(e.message)) {
            out.push("Remote branch does not exist yet, skipping rebase")
          } else {
            throw e
          }
        }
        out.push(await Cmd.executeSilentCommand({ command: `${config.gitPushCommand} -u origin HEAD`, directory, description: "Pushing to git" }, true))
        return out.join("\n")
      } catch (e) {
        // a rebase conflict can not be solved by retrying ; abort and report
        var conflicts = ""
        try {
          conflicts = await Cmd.executeSilentCommand({ command: "git diff --name-only --diff-filter=U", directory, description: "Listing conflicts" }, true)
          // strip the command banner, keep only the actual file list
          conflicts = conflicts.split("\n").filter(l => l.trim() && !l.startsWith("Running command")).join("\n")
        } catch (e2) { /* ignore */ }
        try {
          await Cmd.executeSilentCommand({ command: "git rebase --abort", directory, description: "Aborting rebase" }, true)
        } catch (e2) { /* no rebase in progress */ }
        if (conflicts && conflicts.trim()) {
          throw new Error(`${out.join("\n")}\nSync failed, the rebase has been aborted.\nConflicted files :\n${conflicts.trim()}\nFix the conflicts manually or reset the repository.`, { cause: e })
        }
        if (attempt === attempts) {
          throw new Error(`${out.join("\n")}\nSync failed after ${attempts} attempts :\n${e.message}`, { cause: e })
        }
        out.push(`Sync attempt ${attempt} failed, retrying in 2 seconds...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
};
export default  Repo;
export { validateRepoName, validateBranch, validateUri, validateHostname };
