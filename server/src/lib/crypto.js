import crypto from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs';
import appConfig from '../../config/app.config.js';

const algorithm = 'aes-256-ctr';

const encrypt_to_file = (path,text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', appConfig.encryptionSecret, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final(), iv]);
    const result = Buffer.from(encrypted,'binary').toString('base64');
    fs.writeFileSync(path, result);
};

/**
 * A value encrypted with a given key (as encrypt does with ENCRYPTION_SECRET's).
 *
 * Args:
 *   key (string): the 32-byte key.
 *   text (string): the value.
 *
 * Returns:
 *   string: the ciphertext and its iv, hex, joined by a dot ; empty for an empty value.
 */
const encryptWith = (key, text) => {
    if (!text) return ""
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return encrypted.toString('hex') + "." + iv.toString('hex')
};

/**
 * A value decrypted with a given key, as bytes : AES-CTR never fails on a wrong key, it gives
 * other bytes, so the caller judges them (lib/keyRotation.js).
 *
 * Args:
 *   key (string): the 32-byte key.
 *   hash (string): the ciphertext and its iv, hex, joined by a dot.
 *
 * Returns:
 *   Buffer: the bytes.
 */
const decryptWith = (key, hash) => {
    const [content, iv] = String(hash || "").split(".")
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(content, 'hex')), decipher.final()]);
};

/**
 * A value encrypted with ENCRYPTION_SECRET's key : encryptWith with that key.
 *
 * Args:
 *   text (string): the value.
 *
 * Returns:
 *   string: the ciphertext and its iv, hex, joined by a dot ; empty for an empty value.
 */
const encrypt = (text) => encryptWith(appConfig.encryptionSecret, text);

/**
 * A value decrypted with ENCRYPTION_SECRET's key : decryptWith with that key, as text.
 *
 * Args:
 *   hash (string): the ciphertext and its iv, hex, joined by a dot.
 *
 * Returns:
 *   string: the value ; empty for an empty hash.
 */
const decrypt = (hash) => (hash ? decryptWith(appConfig.encryptionSecret, hash).toString() : "");
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
// a bcrypt hash of nothing anybody types : compared against when a username is unknown, so an
// unknown name takes as long as a wrong password and the timing tells nobody which names exist
// (made once, lazily, at the cost of the real ones : 10 rounds)
let dummyHash = null;
const checkNoPassword = (pw) => new Promise((resolve) => {
  if (!dummyHash) dummyHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
  bcrypt.compare(String(pw ?? ''), dummyHash, () => resolve({ isValid: false }));
});
// promise wrapper for bcrypt compare
const checkPassword = (pw,hash,user) =>{
  return new Promise((resolve,reject)=>{
    bcrypt.compare(pw,hash,function(err,isSame){
      if(err)reject(err)
      resolve({isValid:isSame,user:user});
    });
  })
}


export default {
    encrypt,
    decrypt,
    encryptWith,
    decryptWith,
    encrypt_to_file,
    hashPassword,
    checkPassword,
    checkNoPassword
};
