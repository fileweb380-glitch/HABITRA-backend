const express = require('express');
const router = express.Router();
const { saveSubscription, removeSubscription } = require('../controllers/pushController');
const { protect } = require('../middleware/authMiddleware');

router.post('/subscribe', protect, saveSubscription);
router.post('/unsubscribe', protect, removeSubscription);

router.get('/vapid-public-key', protect, (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

module.exports = router;