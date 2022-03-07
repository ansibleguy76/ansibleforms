const spawn = require('child_process').spawn;
const logger = require('./logger')
const fs = require('fs');
const path = require('path');
const binPath = 'ssh-keygen'

function checkAvailability(location, force,publicOnly, callback){

  function doForce(keyExists, pubKeyExists){
		if(!force && keyExists) return callback(location+' already exists');
		if(!force && pubKeyExists) return callback(pubLocation+' already exists');
		if(!keyExists && !pubKeyExists) return callback();
		if(keyExists){
			logger.warn('removing '+location);
			fs.unlink(location, function(err){
				if(err) return callback(err);
				keyExists = false;
				if(!keyExists && !pubKeyExists) callback();
			});
		}
		if(pubKeyExists) {
			logger.warn('removing '+pubLocation);
			fs.unlink(pubLocation, function(err){
				if(err) return callback(err);
				pubKeyExists = false;
				if(!keyExists && !pubKeyExists) callback();
			});
		}
	}

	var pubLocation = location+'.pub';
  if(publicOnly){
		logger.silly('checking availability: '+pubLocation);
		fs.exists(pubLocation, function(pubKeyExists){
			doForce(false, pubKeyExists);
		})
  }else{
    logger.silly('checking availability: '+location);
  	fs.exists(location, function(keyExists){
  		logger.silly('checking availability: '+pubLocation);
  		fs.exists(pubLocation, function(pubKeyExists){
  			doForce(keyExists, pubKeyExists);
  		})
  	});
  }
}
function ssh_keygen(location, opts, callback){
	opts || (opts={});

	var pubLocation = location+'.pub';
  var keygen
  var output

  if(opts.publicOnly){
    keygen = spawn(binPath, [
      '-f',
      location,
      '-y'
    ]);
  }else{
    keygen = spawn(binPath, [
  		'-t','rsa',
  		'-b', opts.size,
  		'-C', opts.comment,
  		'-N', opts.password,
  		'-f', location,
  		'-m', opts.format
  	]);
  }

	keygen.stdout.on('data', function(a){
    output=a
		// logger.silly('stdout:'+a);
	});

	var read = opts.read;
	var destroy = opts.destroy;

	keygen.on('exit',function(){
    // logger.silly('exit')
    if(opts.publicOnly){
      fs.writeFileSync(pubLocation,output)
    }
		if(read){
			fs.readFile(location, 'utf8', function(err, key){
				if(destroy){
					logger.warn('destroying key '+location);
					fs.unlink(location, function(err){
						if(err) return callback(err);
						readPubKey();
					});
				} else readPubKey();
				function readPubKey(){
					fs.readFile(pubLocation, 'utf8', function(err, pubKey){
						if(destroy){
							logger.warn('destroying pub key '+pubLocation);
							fs.unlink(pubLocation, function(err){
								if(err) return callback(err);
								key = key.toString();
								key = key.substring(0, key.lastIndexOf("\n")).trim();
								pubKey = pubKey.toString();
								pubKey = pubKey.substring(0, pubKey.lastIndexOf("\n")).trim();
								return callback(undefined, {
									key: key, pubKey: pubKey
								});
							});
						} else callback(undefined, { key: key, pubKey: pubKey });
					});
				}
			});
		} else if(callback) callback();
	});

	keygen.stderr.on('data',function(a){
		logger.error('stderr:'+a);
	});
};

module.exports = function(opts, callback){

  // set defaults
  opts.publicOnly = opts.publicOnly ?? false
  opts.force = opts.force ?? false
  opts.read = opts.read ?? true
  opts.destroy = opts.destroy ?? false
  opts.comment = opts.comment || ''
	opts.password = opts.password || ''
	opts.size = opts.size || '2048'
	opts.format = opts.format || 'RFC4716'

	checkAvailability(opts.location, opts.force,opts.publicOnly, function(err){
		if(err){
			return callback(err);
		}
		ssh_keygen(opts.location, opts, callback);
	});
};
