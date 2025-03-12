const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
const logger=require("./logger")
var Cmd = function(){

}

Cmd.killChildren = (pid) => {
  const children = [];

  try {
    const psRes = execSync(`ps -opid="" -oppid="" |grep ${pid}`).toString().trim().split(/\n/);

    (psRes || []).forEach(pidGroup => {
      const [actual, parent] = pidGroup.trim().split(/ +/);

      if (parent.toString() === pid.toString()) {
        children.push(parseInt(actual, 10));
      }
    });
  } catch (e) {}
  try {
    logger.debug(`Killing process ${pid}`)
    process.kill(pid);
    children.forEach(childPid => Cmd.killChildren(childPid));
  } catch (e) {}
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

module.exports = Cmd
