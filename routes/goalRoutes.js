const express = require('express');
const router = express.Router();
const { getGoals, createGoal, updateGoal, deleteGoal } = require('../controllers/goalController');
const requireAuth = require('../middleware/requireAuth');

router.route('/')
  .get(requireAuth, getGoals)
  .post(requireAuth, createGoal);

router.route('/:id')
  .patch(requireAuth, updateGoal);

  router.delete('/:id', requireAuth, deleteGoal);

module.exports = router;