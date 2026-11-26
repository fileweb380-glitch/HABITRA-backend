
const express = require('express');
const router = express.Router();

const {
  registerUser,
    verifyEmail,
      verifyFirebaseEmail,
        resendVerificationEmail,
          forgotPassword,
            resetPassword,
              loginUser,
                getMe
                } = require('../controllers/authController');

                const requireAuth = require('../middleware/requireAuth');
                const { authLimiter } = require('../middleware/rateLimiter');

                // Registration and login
                router.post('/register', authLimiter, registerUser);
                router.post('/login', authLimiter, loginUser);

                // Firebase verification
                router.post('/verify-email/firebase', authLimiter, verifyFirebaseEmail);
                router.post('/resend-verification', authLimiter, resendVerificationEmail);

                // Legacy verification links
                router.get('/verify-email', verifyEmail);

                // Password recovery
                router.post('/forgot-password', authLimiter, forgotPassword);
                router.post('/reset-password', authLimiter, resetPassword);

                // User profile
                router.get('/me', requireAuth, getMe);

                module.exports = router;
                