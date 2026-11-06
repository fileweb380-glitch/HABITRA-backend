const Goal = require('../models/Goal');
const asyncHandler = require('../utils/asyncHandler');

const getGoals = asyncHandler(async (req, res) => {
  const goals = await Goal.find({ owner: req.user._id });
  res.json(goals);
});

const createGoal = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    res.status(400);
    throw new Error('Goal title is required');
  }
  const goal = await Goal.create({ owner: req.user._id, title, description });
  res.status(201).json(goal);
});

module.exports = { getGoals, createGoal };