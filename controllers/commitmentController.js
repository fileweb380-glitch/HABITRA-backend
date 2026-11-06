const Commitment = require('../models/Commitment');
const Checkin = require('../models/Checkin');
const asyncHandler = require('../utils/asyncHandler');

const getCommitments = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const query = { owner: req.user._id };
  if (date) query.scheduledDate = date;
  const commitments = await Commitment.find(query).sort({ scheduledDate: 1, startTime: 1 });
  res.json(commitments);
});

const createCommitment = asyncHandler(async (req, res) => {
  const { title, description, scheduledDate, startTime, isFlexible, durationMinutes, goal, reminderPreferences } = req.body;
  if (!title || !scheduledDate) {
    res.status(400);
    throw new Error('Title and scheduled date are required');
  }
  const commitment = await Commitment.create({
    owner: req.user._id,
    title,
    description,
    scheduledDate,
    startTime: startTime || null,
    isFlexible: isFlexible || false,
    durationMinutes: durationMinutes || 30,
    goal: goal || null,
    reminderPreferences: reminderPreferences || {}
  });
  res.status(201).json(commitment);
});

const updateCommitmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reasonCode, explanation } = req.body;

  const commitment = await Commitment.findOne({ _id: id, owner: req.user._id });
  if (!commitment) {
    res.status(404);
    throw new Error('Commitment not found');
  }

  commitment.status = status;
  if (status === 'Completed') commitment.completedAt = new Date();
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