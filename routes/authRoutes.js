
const express = require('express');
const router = express.Router();

const {
  registerUser,
  forgotPassword,
  resetPassword,
  loginUser,
  getMe
} = require('../controllers/authController');

const requireAuth = require('../middleware/requireAuth');
const { authLimiter } = require('../middleware/rateLimiter');

// REGISTRATION AND LOGIN
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);

// PASSWORD RECOVERY
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// CURRENT USER
router.get('/me', requireAuth, getMe);

module.exports = router;
