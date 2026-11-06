const express = require('express');
const router = express.Router();
const { getDailyReport, getWeeklyReport } = require('../controllers/reportController');
const requireAuth = require('../middleware/requireAuth');

router.get('/daily', requireAuth, getDailyReport);
router.get('/weekly', requireAuth, getWeeklyReport);

module.exports = router;