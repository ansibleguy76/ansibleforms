const express = require('express')
const router = express.Router()
const userController =   require('../controllers/user.controller');
// Retrieve all users
router.get('/', userController.find);
// Create a new user
router.post('/', userController.create);
// Retrieve a single user with id
router.get('/:id', userController.findById);
// Update a user with id
router.put('/:id', userController.update);
// Delete a user with id
router.delete('/:id', userController.delete);

module.exports = router
