'use strict';
import { exec } from 'child_process';
import Cmd from "../lib/cmd.js";
import logger from "../lib/logger.js";
import path from "path";
import fs from "fs";
import config from '../../config/app.config.js';
import quote from 'shell-quote/quote.js'; // shell-escape values interpolated into commands (Cmd runs with shell:true)

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

Repo.delete = async function (name) {

    logger.notice("Deleting repository " + name)
    var directory = config.repoPath

    fs.accessSync(path.join(directory,name))
    // if found and access continue with delete
    fs.rmSync(path.join(directory,name),{force:true,recursive:true})
    return

}

// run git clone
Repo.info = async function (name) {

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
        // branch/uri/name come from the repository config ; shell-escape them
        // since Cmd runs the command string through a shell (no command injection)
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
Repo.addKnownHosts = async function (hosts) {

    if(!hosts){
      throw new Error("No hosts given")
    }else{
      logger.notice(`Adding keys for hosts ${hosts}`)
      // escape each host (user-controlled) ; the command runs through a shell
      var safeHosts = String(hosts).split(/\s+/).filter(Boolean).map(h => quote([h])).join(' ')
      var cmd = `ssh-keyscan ${safeHosts} >> ~/.ssh/known_hosts`
      logger.notice(`Running cmd : ${cmd}`)
      var known_hosts = exec(cmd,{})
      var output = []
      known_hosts.stdout.on('data', function(a){
        logger.info(a)
        output.push(a)
      });

      known_hosts.on('exit',function(code){
        logger.debug('exit')
        if(code==0){
          return `Adding keys ran succesfully\n${output.join("\n")}`
        }else{
          throw new Error(`\nAdding keys failed with code ${code}\n${output.join("\n")}`)
        }
      });

      known_hosts.stderr.on('data',function(a){
        output.push(a)
        logger.error('stderr:'+a);
      });
    }

};

// run a playbook
Repo.pull = async function (name) {
      var command = `${config.gitPullCommand} --verbose`
      var directory = path.join(config.repoPath,name)
      return await Cmd.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"},true)
};

// does the working tree have uncommitted changes, or local commits not yet
// pushed to the remote ? (issue #414, used to flag unpushed designer work)
Repo.hasChanges = async function (name) {
    const directory = path.join(config.repoPath, name)
    const clean = (out) => String(out).split("\n").filter(l => l.trim() && !l.startsWith("Running command"))
    try {
      const dirty = await Cmd.executeSilentCommand({ directory, command: "git status --porcelain", description: "Checking status" }, true)
      if (clean(dirty).length > 0) return true
      // count commits ahead of the upstream (no upstream => command throws => caught)
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
        out.push(await Cmd.executeSilentCommand({ command: "git push -u origin HEAD", directory, description: "Pushing to git" }, true))
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
          throw new Error(`${out.join("\n")}\nSync failed, the rebase has been aborted.\nConflicted files :\n${conflicts.trim()}\nFix the conflicts manually or reset the repository.`)
        }
        if (attempt === attempts) {
          throw new Error(`${out.join("\n")}\nSync failed after ${attempts} attempts :\n${e.message}`)
        }
        out.push(`Sync attempt ${attempt} failed, retrying in 2 seconds...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
};
export default  Repo;
