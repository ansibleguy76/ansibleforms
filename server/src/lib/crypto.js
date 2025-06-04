const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fs = require('fs');
const appConfig = require('../../config/app.config')
const inspect = require('util').inspect;

const algorithm = 'aes-256-ctr';

const encrypt = (text) => {
    if(text){
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, appConfig.encryptionSecret, iv);
      const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
      return encrypted.toString('hex') + "." + iv.toString('hex')
    }else{
      return ""
    }
};

const encrypt_to_file = (path,text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', appConfig.encryptionSecret, iv);
    encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final(), iv]);
    const result = Buffer.from(encrypted,'binary').toString('base64');
    fs.writeFileSync(path, result);
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
    encrypt_to_file,
    hashPassword,
    checkPassword
};
