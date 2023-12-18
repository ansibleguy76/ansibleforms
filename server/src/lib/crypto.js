const crypto = require('crypto');
const bcrypt = require('bcrypt');
const appConfig = require('../../config/app.config')

const algorithm = 'aes-256-ctr';
const iv = crypto.randomBytes(16);

const encrypt = (text) => {
    if(text){
      const cipher = crypto.createCipheriv(algorithm, appConfig.encryptionSecret, iv);
      const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
      return encrypted.toString('hex') + "." + iv.toString('hex')
    }else{
      return ""
    }
};

const decrypt = (hash) => {
    if(hash){
      const tmp = hash.split(".")
      const hash2 = {content:tmp[0],iv:tmp[1]}
      const decipher = crypto.createDecipheriv(algorithm, appConfig.encryptionSecret, Buffer.from(hash2.iv, 'hex'));
      const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash2.content, 'hex')), decipher.final()]);
      return decrpyted.toString();
    }else{
      return ""
    }

};
// promise wrapper for bcrypthash
const hashPassword = (pw) => {
    const saltrounds = 10
    return new Promise((resolve,reject)=>{
      bcrypt.hash(pw, saltrounds,(err,hash)=>{
        if(err) reject(err)
        resolve(hash)
      })
    })
}
// promise wrapper for bcrypt compare
const checkPassword = (pw,hash,user) =>{
  return new Promise((resolve,reject)=>{
    bcrypt.compare(pw,hash,function(err,isSame){
      if(err)reject(err)
      resolve({isValid:isSame,user:user});
    });
  })
}


module.exports = {
    encrypt,
    decrypt,
    hashPassword,
    checkPassword
};
