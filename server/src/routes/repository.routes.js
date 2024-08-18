const express = require('express')
const router = express.Router()
const repositoryController =   require('../controllers/repository.controller');
// Retrieve all repositorys
router.get('/', repositoryController.find);
// Create a new repository
router.post('/', repositoryController.create);
// Retrieve a single repository with id
router.get('/:name', repositoryController.findByName);
// Update a repository with id
router.put('/:name', repositoryController.update);
// Delete a repository with id
router.delete('/:name', repositoryController.delete);
// Clone a repository by name
router.post('/:name/clone/', repositoryController.clone);
// reset a repository by name
router.post('/:name/reset/', repositoryController.reset);
// Pull a repository by name
router.post('/:name/pull/', repositoryController.pull);

module.exports = router