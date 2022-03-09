const express = require('express')
const router = express.Router()
const repoController =   require('../controllers/repo.controller');

// get repos
router.get('/', repoController.find);
// create repo
router.post('/', repoController.create);
// create repo
router.delete('/', repoController.delete);

module.exports = router
