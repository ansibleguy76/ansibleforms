const express = require('express')
const router = express.Router()
const repoController =   require('../controllers/repo.controller');

// get repos
router.get('/', repoController.find);
// create repo
router.post('/', repoController.create);
// create repo
router.post('/known_hosts/', repoController.addKnownHosts);
// create repo
router.delete('/', repoController.delete);
// pull repo
router.post('/pull/:repositoryName', repoController.pull)

module.exports = router
