import { readFileSync } from 'fs';
import RestResult from '../../models/restResult.model.v2.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.resolve(__dirname, '../../../package.json');
const pkgContent = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgContent);

// Load build info if available
let buildInfo = null;
try {
    const buildInfoPath = path.resolve(__dirname, '../../../build-info.json');
    const buildInfoContent = readFileSync(buildInfoPath, 'utf8');
    buildInfo = JSON.parse(buildInfoContent);
} catch (err) {
    // build-info.json not found (dev environment) - this is ok
}

const get = function(req, res) {
    const versionData = {
        version: pkg.version,
        server: buildInfo || { gitSha: 'dev', dirty: false, buildTime: null }
    };
    res.json(RestResult.single(versionData));
};

export default {
    get
};
