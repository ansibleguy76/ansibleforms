const express = require('express')
const router = express.Router()
const knownhostsController =   require('../controllers/knownhosts.controller');

// get 
router.get('/', knownhostsController.find);
// add
router.post('/', knownhostsController.add);
// remove
router.delete('/', knownhostsController.remove);

module.exports = router
