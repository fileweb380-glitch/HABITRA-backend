const Commitment = require('../models/Commitment');
const User = require('../models/User');
const Checkin = require('../models/Checkin');
const schedulerService = require('../services/schedulerService');
const asyncHandler = require('../utils/asyncHandler');

// Helper to parse HH:mm strings into numbers
const parseTime = (timeStr) => {
  const [h, m] = (timeStr || '08:00').split(':').map(Number);
  return { hours: h, minutes: m };
};

// @desc    Get user commitments (optional date query filter)
// @route   GET /api/commitments
const getCommitments = asyncHandler(async (req, res) => {
  const { date, scheduledDate } = req.query;
  const query = { owner: req.user._id };
  const targetDate = scheduledDate || date;
  if (targetDate) query.scheduledDate = targetDate;

  const commitments = await Commitment.find(query).sort({ scheduledDate: 1, startTime: 1 });
  res.json(commitments);
});

// @desc    Create commitment with Nightly Planning Window enforcement & Reminder Dispatch
// @route   POST /api/commitments
const createCommitment = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    scheduledDate,
    date,
    startTime,
    time,
    durationMinutes,
    isFlexible,
    isFlexibleTime,
    isFlexibleDuration,
    goal,
    reminderPreferences
  } = req.body;

  // Support both frontend and backend naming conventions
  const finalScheduledDate = scheduledDate || date;
  const finalStartTime = startTime || time;
  const finalIsFlexible = isFlexible !== undefined ? isFlexible : (isFlexibleTime || false);

  if (!title || !finalScheduledDate) {
    res.status(400);
    throw new Error('Title and scheduled date are required');
  }

  // --- GATE 1: PLAN TOMORROW WINDOW RESTRICTION ---
  const user = await User.findById(req.user._id);
  const { hours: startHour, minutes: startMinute } = parseTime(user?.startOfDay || '08:00');

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isPastStartOfDay = currentHour > startHour || (currentHour === startHour && currentMinute >= startMinute);
  const isBeforeEvening = currentHour < 17;

  if (isPastStartOfDay && isBeforeEvening) {
    res.status(403);
    throw new Error(`Plan Tomorrow is locked. Planning is only open between 5:00 PM and your start-of-day (${user?.startOfDay || '08:00 AM'}).`);
  }
  // ------------------------------------------------

  const commitment = await Commitment.create({
    owner: req.user._id,
    title,
    description: description || '',
    category: category || 'Personal projects',
    scheduledDate: finalScheduledDate,
    startTime: finalIsFlexible ? null : (finalStartTime || null),
    isFlexible: !!finalIsFlexible,
    isFlexibleDuration: !!isFlexibleDuration,
    durationMinutes: isFlexibleDuration ? null : (Number(durationMinutes) || 30),
    goal: goal && goal !== '' ? goal : null,
    reminderPreferences: reminderPreferences || {}
  });

  // --- TRIGGER START/END REMINDER JOBS ---
  try {
    await schedulerService.scheduleCommitmentReminders(commitment);
  } catch (schedulerErr) {
    console.error('Non-fatal scheduler error:', schedulerErr.message);
  }

  res.status(201).json(commitment);
});

// @desc    Update status with Past-Day Lock enforcement & Missed Reason recording
// @route   PATCH /api/commitments/:id/status
const updateCommitmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reasonCode, explanation } = req.body;

  const commitment = await Commitment.findOne({ _id: id, owner: req.user._id });
  if (!commitment) {
    res.status(404);
    throw new Error('Commitment not found');
  }

  // --- GATE 2: HISTORICAL IMMUTABLE LOCK ---
  const todayStr = new Date().toISOString().split('T')[0];
  if (commitment.scheduledDate < todayStr) {
    res.status(403);
    throw new Error('Historical lock: Past commitments cannot be modified. Historical data is preserved for honest reflection.');
  }
  // ----------------------------------------

  commitment.status = status;
  if (status === 'Completed') commitment.completedAt = new Date();
  
  if (status === 'Missed') {
    commitment.missedReason = reasonCode || 'Unspecified';
    commitment.missedNote = explanation || '';
  } else {
    commitment.missedReason = undefined;
    commitment.missedNote = undefined;
  }

  await commitment.save();

  if (['Completed', 'Missed', 'Unconfirmed'].includes(status)) {
    await Checkin.create({
      owner: req.user._id,
      commitment: commitment._id,
      commitmentDate: commitment.scheduledDate,
      response: status,
      reasonCode: reasonCode || null,
      explanation: explanation || ''
    });
  }

  res.json({
    message: status === 'Missed' ? 'Reason recorded. Your original commitment remains unchanged.' : 'Commitment updated successfully.',
    commitment
  });
});

module.exports = { getCommitments, createCommitment, updateCommitmentStatus };