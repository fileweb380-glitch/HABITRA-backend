const Commitment = require('../models/Commitment');
const Habit = require('../models/Habit');
const HabitEntry = require('../models/HabitEntry');
const WeeklyReflection = require('../models/WeeklyReflection');
const asyncHandler = require('../utils/asyncHandler');

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

// Helper to get current ISO week string e.g. "2026-W45"
const getISOWeekString = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const getDailyReport = asyncHandler(async (req, res) => {
  const todayStr = getAddisDateString();
  const targetDate = req.query.date || todayStr;

  const commitments = await Commitment.find({ owner: req.user._id, scheduledDate: targetDate });
  const habitEntries = await HabitEntry.find({ owner: req.user._id, date: targetDate })
    .populate('habit', 'title category time durationMinutes');

  const totalEligibleCommitments = commitments.filter((c) => c.status !== 'Cancelled').length;
  const completedCommitments = commitments.filter((c) => c.status === 'Completed').length;
  const missedCommitments = commitments.filter((c) => c.status === 'Missed').length;
  const unconfirmedCommitments = commitments.filter(
    (c) => c.status === 'Scheduled' || c.status === 'Unconfirmed'
  ).length;

  const completedHabitsCount = habitEntries.filter((e) => e.outcome === 'Completed').length;
  const missedHabitsCount = habitEntries.filter((e) => e.outcome === 'Missed').length;

  const totalEligible = totalEligibleCommitments + habitEntries.length;
  const completedCount = completedCommitments + completedHabitsCount;
  const missedCount = missedCommitments + missedHabitsCount;

  res.json({
    date: targetDate,
    totalEligible,
    completedCount,
    missedCount,
    unconfirmedCount: unconfirmedCommitments,
    completionRate: totalEligible > 0 ? Math.round((completedCount / totalEligible) * 100) : 0,
    commitments,
    habitEntries
  });
});
const getWeeklyReport = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const startDate = dates[0];
  const endDate = dates[6];

  const commitments = await Commitment.find({
    owner: userId,
    scheduledDate: { $in: dates }
  });

  const habitEntries = await HabitEntry.find({
    user: userId,
    date: { $in: dates },
    outcome: 'Completed'
  });

  const totalEligible = commitments.filter((c) => c.status !== 'Cancelled').length;
  const completedCommitments = commitments.filter((c) => c.status === 'Completed').length;
  const completedHabits = habitEntries.length;
  const completionRate = totalEligible > 0 ? Math.round((completedCommitments / totalEligible) * 100) : 0;

  const weekIdentifier = getISOWeekString();
  const reflection = await WeeklyReflection.findOne({ owner: userId, weekIdentifier });

  res.json({
    startDate,
    endDate,
    completionRate,
    completedCommitments,
    completedHabits,
    totalEligible,
    reflection: reflection || {}
  });
});

const saveWeeklyReflection = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const weekIdentifier = getISOWeekString();

  const latestReflection = await WeeklyReflection.findOne({ owner: userId }).sort({ createdAt: -1 });

  if (latestReflection) {
    const lastSavedDate = new Date(latestReflection.createdAt);
    const currentDate = new Date();
    const diffInTime = currentDate.getTime() - lastSavedDate.getTime();
    const diffInDays = diffInTime / (1000 * 3600 * 24);

    if (diffInDays < 7) {
      const daysRemaining = Math.ceil(7 - diffInDays);
      return res.status(400).json({
        error: `Weekly Reflection is locked. You can submit your next reflection in ${daysRemaining} day(s).`
      });
    }
  }

  const { wentWell, struggledWith, accomplishments, improve, priorities } = req.body;
  const newReflection = await WeeklyReflection.create({
    owner: userId,
    weekIdentifier,
    wentWell,
    struggledWith,
    accomplishments,
    improve,
    priorities
  });

  res.status(201).json({
    message: 'Weekly reflection locked and saved for the next 7 days!',
    reflection: newReflection
  });
});

module.exports = { getDailyReport, getWeeklyReport, saveWeeklyReflection };