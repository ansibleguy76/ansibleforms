const spawn = require('child_process').spawn;
const logger = require('./logger')
const fs = require('fs');
const path = require('path');
const binPath = 'ssh-keygen'

// SSH KEY GEN LIBRARY 
// USES PROMISES

var Keygen = {}
// check if file exists with possible force remove
Keygen.exists = function(path,forceRemove){
    logger.debug('checking availability: '+ path);
    // can we access it ?
    return fs.promises.access(path)
      .then(()=>{
        // do we need to remove ?
        if(forceRemove){
          logger.debug('removing '+ path);
          return fs.promises.unlink(path)
            .then(()=>{
              // file doesn't exist (we just removed it)
              return false
            })
        }else{
          // file exists
          logger.debug('already exists: '+ path);
          return true
        }
      })
      .catch(()=>{
        // file doesn't exist
        return false
      })
}
// read a key and trims it
Keygen.readKey = function(path,destroy){
	return fs.promises.readFile(path, 'utf8')
    .then((key)=>{
      key = key.toString();
      key = key.substring(0, key.lastIndexOf("\n")).trim();
      if(destroy){
        fs.promises.unlink(path).catch((err)=>{ throw err })
      }
      return key
    })
}
// check if private and/or public keys exists, with possible forcer removal
Keygen.checkAvailability = function(privateKeyPath, force,publicOnly){
  var publicKeyPath = privateKeyPath+'.pub';
  if(publicOnly){
    return Keygen.exists(publicKeyPath,force)
  }else{
    return Keygen.exists(privateKeyPath,force)
      .then((exists)=>{
        if(!exists){
          // if private key doesn't exist, remove public key
          return Keygen.exists(publicKeyPath,force)
        }else{
          return true
        }
      })
  }
}
// get random art from private key
Keygen.ssh_randomart =function(privateKeyPath){
  logger.debug("Getting private key random art from " + privateKeyPath)

  return fs.promises.access(privateKeyPath)
    .catch(()=>{ throw "No private key found" })
    .then(()=>{
        return new Promise((resolve,reject)=>{
          var output
          var keygen = spawn(binPath, [
            '-lvf',
            privateKeyPath
          ])

          keygen.stdout.on('data', function(a){
            output=a
          });

          keygen.on('exit',function(){
            // logger.debug('exit')
            if(output){
              resolve({art:output.toString()})
            }else{
              reject("No private key found")
            }
          });

          keygen.stderr.on('data',function(a){
            logger.error('stderr:'+a);
          });
        })

    })
};
// create new keys
Keygen.ssh_keygen = function(privateKeyPath, opts){

  return new Promise((resolve,reject)=>{
    opts || (opts={});

  	var publicKeyPath = privateKeyPath+'.pub';
    var keygen
    var output=""

    if(opts.publicOnly){
      keygen = spawn(binPath, [
        '-f',
        privateKeyPath,
        '-yq'
      ]);
    }else{
      keygen = spawn(binPath, [
    		'-t','rsa',
    		'-b', opts.size,
    		'-C', opts.comment,
    		'-N', opts.password,
    		'-f', privateKeyPath,
    		'-m', opts.format
    	]);
    }

  	keygen.stdout.on('data', function(a){
      // only output for public key - the other spawn, generates file
      output=a
  		// logger.debug('stdout:'+a);
  	});
    keygen.stderr.on('data',function(a){
      logger.error('stderr:'+a);
    });
  	var read = opts.read;
  	var destroy = opts.destroy;

  	keygen.on('exit',function(){
      // logger.debug('exit')
      if(opts.publicOnly){
        // write public key
        fs.writeFileSync(publicKeyPath,output)
      }
  		if(read){
  			Keygen.readKey(privateKeyPath,destroy)
          .then((privatekey)=>{
            Keygen.readKey(publicKeyPath,destroy)
              .then((publickey)=>{
                resolve({ key: privatekey, pubKey: publickey})
              })
          })
          .catch((err)=>reject(err))
  		} else resolve();
  	});
  })
};
// main function to handle all options
Keygen.keygen = async function(opts, callback){

  // set defaults
  opts.randomArt = opts.randomArt ?? false    // get random art of priate key
  opts.publicOnly = opts.publicOnly ?? false  // only process public key
  opts.force = opts.force ?? false            // force remove before starting
  opts.read = opts.read ?? true               // read keys after generating
  opts.destroy = opts.destroy ?? false        // destroy keys after generating
  opts.comment = opts.comment || ''           // add comment to key
	opts.password = opts.password || ''         // password protection
	opts.size = opts.size || '2048'             // encryption size
	opts.format = opts.format || 'RFC4716'      // encryption format

  if(opts.randomArt){
    return Keygen.ssh_randomart(opts.path);
  }else{

  	return Keygen.checkAvailability(opts.path, opts.force,opts.publicOnly)
      .then((exists)=>{
        if(exists){
          throw "already exists"
        }else{
          return Keygen.ssh_keygen(opts.path, opts);
        }
      })
  }
};

module.exports = Keygen
