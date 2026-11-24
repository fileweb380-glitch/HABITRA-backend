const Goal = require('../models/Goal');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get all user goals
// @route   GET /api/goals
const getGoals = asyncHandler(async (req, res) => {
  const goals = await Goal.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json(goals);
});

// @desc    Create a new goal with milestones
// @route   POST /api/goals
const createGoal = asyncHandler(async (req, res) => {
  const { title, description, category, targetDate, milestones } = req.body;

  if (!title || !targetDate) {
    res.status(400);
    throw new Error('Goal title and target date are required');
  }

  const goal = await Goal.create({
    owner: req.user._id,
    title,
    description: description || '',
    category: category || 'Personal projects',
    targetDate,
    milestones: milestones || []
  });

  res.status(201).json(goal);
});


const updateGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, owner: req.user._id });
  if (!goal) throw new AppError('Goal not found', 404);

  const { title, description, category, targetDate, milestones, status } = req.body;
  if (title) goal.title = title;
  if (description !== undefined) goal.description = description;
  if (category) goal.category = category;
  if (targetDate) goal.targetDate = targetDate;
  if (milestones) goal.milestones = milestones;
  if (status) goal.status = status;

  const updatedGoal = await goal.save();
  res.json(updatedGoal);
});

const deleteGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!goal) throw new AppError('Goal not found', 404);
  res.json({ message: 'Goal deleted successfully' });
});

module.exports = { getGoals, createGoal, updateGoal, deleteGoal };