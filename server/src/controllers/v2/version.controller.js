import { readFileSync } from 'fs';
import RestResult from '../../models/restResult.model.v2.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, '../../../package.json');
const pkgContent = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgContent);

const get = function(req, res) {
    res.json(RestResult.single(pkg.version));
};

export default {
    get
};
