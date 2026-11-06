const express = require('express');
const router = express.Router();
const { getHabits, createHabit, logHabitEntry } = require('../controllers/habitController');
const requireAuth = require('../middleware/requireAuth');

router.route('/').get(requireAuth, getHabits).post(requireAuth, createHabit);
router.post('/:habitId/entries', requireAuth, logHabitEntry);

module.exports = router;