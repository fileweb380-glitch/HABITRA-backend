const express = require('express');
const router = express.Router();
const { getGoals, createGoal } = require('../controllers/goalController');
const requireAuth = require('../middleware/requireAuth');

router.route('/').get(requireAuth, getGoals).post(requireAuth, createGoal);

module.exports = router;