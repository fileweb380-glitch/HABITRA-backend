const express = require('express');
const router = express.Router();
const { getDailyReport, getWeeklyReport, saveWeeklyReflection } = require('../controllers/reportController');
const requireAuth = require('../middleware/requireAuth');

router.get('/daily', requireAuth, getDailyReport);
router.get('/weekly', requireAuth, getWeeklyReport);
router.post('/weekly/reflection', requireAuth, saveWeeklyReflection);

module.exports = router;