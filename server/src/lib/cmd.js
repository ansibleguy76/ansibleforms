import { spawn, exec, execSync } from 'child_process';
import logger from './logger.js';
var Cmd = function(){

}

Cmd.killChildren = (pid) => {
  const children = [];

  // Defensive: pid must be numeric. Anything else is an injection attempt
  // or a programming bug. Reject loudly rather than splice into a shell command.
  const numericPid = parseInt(pid, 10);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    logger.warning(`Cmd.killChildren: refusing non-numeric pid ${JSON.stringify(pid)}`);
    return;
  }

  try {
    const psRes = execSync(`ps -opid="" -oppid="" |grep ${numericPid}`).toString().trim().split(/\n/);

    (psRes || []).forEach(pidGroup => {
      const [actual, parent] = pidGroup.trim().split(/ +/);

      if (parent && parent.toString() === numericPid.toString()) {
        children.push(parseInt(actual, 10));
      }
    });
  } catch (e) {
    logger.debug(`Cmd.killChildren: ps lookup failed for pid ${numericPid}: ${e.message}`);
  }
  try {
    logger.debug(`Killing process ${numericPid}`)
    process.kill(numericPid);
    children.forEach(childPid => Cmd.killChildren(childPid));
  } catch (e) {
    logger.debug(`Cmd.killChildren: process.kill failed for pid ${numericPid}: ${e.message}`);
  }
};

Cmd.runCommand = (cmd) => {
  return exec(cmd, {});
};

Cmd.executeSilentCommand = async (cmd,silent=false,singleLine=false,timeoutSeconds=60) => {
  return new Promise((resolve,reject)=>{
    try{
      var command = cmd.command
      var directory = cmd.directory
      var description = cmd.description
      var maskedCommand = cmd.maskedCommand || cmd.command
      // execute the procces
      logger.debug(`${description}, ${directory} > ${maskedCommand}`)
  
      var cmdlist = command.split(' ')
      var basecmd = cmdlist[0]
      var parameters = cmdlist.slice(1)
      var child = spawn(basecmd,parameters,{shell:true,stdio:["ignore","pipe","pipe"],cwd:directory,detached:true});
        var timeout = setTimeout(()=>{
          Cmd.killChildren(child.pid)
        },timeoutSeconds*1000)
        var out=[]
        if(!singleLine){
          out.push(`Running command : ${maskedCommand}`)
        }
        if(!silent){
          logger.notice(`Running command : ${maskedCommand}`)          
        }
        
        // add output eventlistener to the process to save output
        child.stdout.on('data',function(data){
          var txt=data.toString()
          // txt = Cmd.maskGitToken(txt)
          out.push(txt)
        })
        // add error eventlistener to the process to save output
        child.stderr.on('data',function(data){
          var txt=data.toString()
          // txt = Cmd.maskGitToken(txt)
          out.push(txt)
        })
        // add exit eventlistener to the process to handle status update
        child.on('exit',function(data){
          clearTimeout(timeout)
          logger.info(description + " finished : " + data)
          // always push something to
          // remove all \n from the end of the output and \r\n
          out = out.map((line)=>{
            return line.replace(/\n+$/g,'').replace(/\r\n/g,'')
          })
          out.push("")
          if(data!=0){
            if(child.signalCode=='SIGTERM'){
              out.push("The command timed out")
            }

            if(singleLine){
              reject(new Error(out[0]))
              return
            }else{
              reject(new Error(out.join("\n")))
              return
            }
          }
          if(singleLine){
            resolve(out[0])
            return
          }else{
            resolve(out.join('\n'))
            return 
          }

        })
        // add error eventlistener to the process; set failed
        child.on('error',function(data){
          var txt=data.toString()
          // txt = Cmd.maskGitToken(txt)
          out.push(txt)
          reject(new Error(out.join('\n')))
          return
        })

    }catch(e){
      reject(e.message)
    }   
  })

}

export default Cmd
