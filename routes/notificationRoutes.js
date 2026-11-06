const express = require('express');
const router = express.Router();
const { savePushSubscription } = require('../controllers/notificationController');
const requireAuth = require('../middleware/requireAuth');

router.post('/subscribe', requireAuth, savePushSubscription);

module.exports = router;