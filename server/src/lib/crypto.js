const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const secretKey = process.env.ENCRYPTION_SECRET || "AnsibleForms!123";
const iv = crypto.randomBytes(16);

const encrypt = (text) => {

    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return encrypted.toString('hex') + "." + iv.toString('hex')

};

const decrypt = (hash) => {
    const tmp = hash.split(".")
    const hash2 = {content:tmp[0],iv:tmp[1]}

    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash2.iv, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash2.content, 'hex')), decipher.final()]);

    return decrpyted.toString();
};

module.exports = {
    encrypt,
    decrypt
};
