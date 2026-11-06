const Habit = require('../models/Habit');
const HabitEntry = require('../models/HabitEntry');
const asyncHandler = require('../utils/asyncHandler');

const getHabits = asyncHandler(async (req, res) => {
  const habits = await Habit.find({ owner: req.user._id, isActive: true });
  res.json(habits);
});

const createHabit = asyncHandler(async (req, res) => {
  const { title, recurrence } = req.body;
  if (!title) {
    res.status(400);
    throw new Error('Habit title is required');
  }
  const habit = await Habit.create({ owner: req.user._id, title, recurrence: recurrence || 'daily' });
  res.status(201).json(habit);
});

const logHabitEntry = asyncHandler(async (req, res) => {
  const { habitId } = req.params;
  const { date, outcome, quantity, note } = req.body;
  if (!date) {
    res.status(400);
    throw new Error('Date is required');
  }
  const entry = await HabitEntry.findOneAndUpdate(
    { owner: req.user._id, habit: habitId, date },
    { outcome: outcome || 'Completed', quantity, note },
    { new: true, upsert: true }
  );
  res.json(entry);
});

module.exports = { getHabits, createHabit, logHabitEntry };