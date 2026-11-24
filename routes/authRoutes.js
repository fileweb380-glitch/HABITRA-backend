const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  verifyEmail, 
  resendVerificationEmail,
  forgotPassword, 
  resetPassword, 
  loginUser, 
  getMe 
} = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');
const { authLimiter } = require('../middleware/rateLimiter');

// Registration & Login
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);

// Verification & Password Recovery
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', requireAuth, authLimiter, resendVerificationEmail);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// Authenticated User Profile
router.get('/me', requireAuth, getMe);

module.exports = router;