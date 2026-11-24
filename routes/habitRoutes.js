const express = require('express');
const router = express.Router();
const {
  getHabits,
  createHabit,
  logHabitEntry,
  handleEmailCheckinResponse,
  updateHabit,
  deleteHabit
} = require('../controllers/habitController');
const { protect } = require('../middleware/authMiddleware');

// Public one-click email check-in endpoint
router.get('/checkin-response', handleEmailCheckinResponse);

// Protected habit routes
router.route('/')
  .get(protect, getHabits)
  .post(protect, createHabit);

router.post('/:habitId/entry', protect, logHabitEntry);

router.route('/:id')
  .put(protect, updateHabit)
  .delete(protect, deleteHabit);

module.exports = router;