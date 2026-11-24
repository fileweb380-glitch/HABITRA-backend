const express = require('express');
const router = express.Router();
const { updateProfile, changePassword, deleteAccount } = require('../controllers/userController');
const requireAuth = require('../middleware/requireAuth');

router.patch('/profile', requireAuth, updateProfile);
router.post('/change-password', requireAuth, changePassword);
router.delete('/account', requireAuth, deleteAccount);

module.exports = router;