const Habit = require('../models/Habit');
const HabitEntry = require('../models/HabitEntry');
const asyncHandler = require('../utils/asyncHandler');

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Helper: Get YYYY-MM-DD in Africa/Addis_Ababa
const getAddisDateString = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return `${year}-${month}-${day}`;
};

// @desc    Get all active habits for user
const getHabits = asyncHandler(async (req, res) => {
  const habits = await Habit.find({ user: req.user._id, status: 'active' }).sort({ createdAt: -1 });
  res.json(habits);
});

// @desc    Create a new habit
const createHabit = asyncHandler(async (req, res) => {
  const {
    title,
    category,
    frequency,
    time,
    scheduledTime,
    durationMinutes,
    isFlexibleTime,
    isFlexibleDuration,
    days,
    monthlyDate,
    yearlyDate,
    reminderPref
  } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Habit title is required');
  }

  const habitTime = isFlexibleTime ? null : (time || scheduledTime || '08:00');
  const habitDuration = isFlexibleDuration ? 5 : (durationMinutes !== undefined ? Number(durationMinutes) : 30);
  const chosenReminderPref = reminderPref || req.user.reminderPref || 'both';

  const habit = await Habit.create({
    user: req.user._id,
    title,
    category: category || 'Personal projects',
    frequency: frequency || 'daily',
    time: habitTime,
    durationMinutes: habitDuration,
    isFlexibleTime: !!isFlexibleTime,
    isFlexibleDuration: !!isFlexibleDuration,
    days: frequency === 'weekly' ? (days || []) : [],
    monthlyDate: frequency === 'monthly' ? Number(monthlyDate) : undefined,
    yearlyDate: frequency === 'yearly' ? yearlyDate : undefined,
    reminderPref: chosenReminderPref,
    status: 'active'
  });

  res.status(201).json(habit);
});

// @desc    Log a habit entry completion or missed reason (from frontend modal or dashboard)
const logHabitEntry = asyncHandler(async (req, res) => {
  const { habitId } = req.params;
  const { date, outcome, quantity, note } = req.body;

  const targetDate = date || getAddisDateString();

  // Habit model uses 'user'
  const habit = await Habit.findOne({ _id: habitId, user: req.user._id });
  if (!habit) {
    res.status(404);
    throw new Error('Habit not found');
  }

  // HabitEntry model uses 'owner'
  const entry = await HabitEntry.findOneAndUpdate(
    { owner: req.user._id, habit: habitId, date: targetDate },
    {
      owner: req.user._id,
      habit: habitId,
      date: targetDate,
      outcome: outcome || 'Completed',
      quantity,
      note: note || ''
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  res.json(entry);
});

// @desc    Handle one-click email response (e.g., "Yes, Completed")
const handleEmailCheckinResponse = asyncHandler(async (req, res) => {
  const { habitId, status, date, note } = req.query;

  if (!habitId) {
    return res.status(400).send('<h3>Invalid check-in link: Missing habit ID.</h3>');
  }

  const habit = await Habit.findById(habitId);
  if (!habit) {
    return res.status(404).send('<h3>Habit not found or deleted.</h3>');
  }

  const targetDate = date || getAddisDateString();
  const resolvedOutcome = status === 'Completed' ? 'Completed' : 'Missed';

  // HabitEntry model uses 'owner' (habit.user holds the User ObjectId)
  await HabitEntry.findOneAndUpdate(
    { owner: habit.user, habit: habit._id, date: targetDate },
    {
      owner: habit.user,
      habit: habit._id,
      date: targetDate,
      outcome: resolvedOutcome,
      note: note || (resolvedOutcome === 'Completed' ? 'Completed via email check-in' : 'Not completed')
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  return res.redirect(`${FRONTEND_BASE_URL}/reports/daily?date=${targetDate}&checkinSuccess=1`);
});

// @desc    Update a habit
const updateHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOne({ _id: req.params.id, user: req.user._id });
  if (!habit) {
    res.status(404);
    throw new Error('Habit not found');
  }

  const {
    title,
    category,
    frequency,
    days,
    monthlyDate,
    yearlyDate,
    time,
    durationMinutes,
    reminderPref,
    status
  } = req.body;

  if (title !== undefined) habit.title = title;
  if (category !== undefined) habit.category = category;
  if (frequency !== undefined) habit.frequency = frequency;
  if (days !== undefined) habit.days = days;
  if (monthlyDate !== undefined) habit.monthlyDate = monthlyDate;
  if (yearlyDate !== undefined) habit.yearlyDate = yearlyDate;
  if (time !== undefined) habit.time = time;

  if (durationMinutes !== undefined && durationMinutes !== null) {
    habit.durationMinutes = Number(durationMinutes);
    habit.markModified('durationMinutes');
  }

  if (reminderPref !== undefined) habit.reminderPref = reminderPref;
  if (status !== undefined) habit.status = status;

  const updatedHabit = await habit.save();
  res.json(updatedHabit);
});

// @desc    Delete a habit
const deleteHabit = asyncHandler(async (req, res) => {
  const habit = await Habit.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!habit) {
    res.status(404);
    throw new Error('Habit not found');
  }
  res.json({ message: 'Habit deleted successfully', id: req.params.id });
});

module.exports = {
  getHabits,
  createHabit,
  logHabitEntry,
  handleEmailCheckinResponse,
  updateHabit,
  deleteHabit
};