const Commitment = require('../models/Commitment');
const Checkin = require('../models/Checkin');
const asyncHandler = require('../utils/asyncHandler');

const getDailyReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) {
    res.status(400);
    throw new Error('Date is required');
  }
  const commitments = await Commitment.find({ owner: req.user._id, scheduledDate: date });
  const checkins = await Checkin.find({ owner: req.user._id, commitmentDate: date });

  const totalEligible = commitments.filter(c => c.status !== 'Cancelled').length;
  const completedCount = commitments.filter(c => c.status === 'Completed').length;
  const missedCount = commitments.filter(c => c.status === 'Missed').length;

  res.json({
    date,
    totalEligible,
    completedCount,
    missedCount,
    completionRate: totalEligible > 0 ? Math.round((completedCount / totalEligible) * 100) : 0,
    commitments,
    checkins
  });
});

const getWeeklyReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    res.status(400);
    throw new Error('startDate and endDate are required');
  }
  const commitments = await Commitment.find({
    owner: req.user._id,
    scheduledDate: { $gte: startDate, $lte: endDate }
  });

  const totalEligible = commitments.filter(c => c.status !== 'Cancelled').length;
  const completedCount = commitments.filter(c => c.status === 'Completed').length;
  const missedCount = commitments.filter(c => c.status === 'Missed').length;

  res.json({
    startDate,
    endDate,
    totalEligible,
    completedCount,
    missedCount,
    overallRate: totalEligible > 0 ? Math.round((completedCount / totalEligible) * 100) : 0,
    commitments
  });
});

module.exports = { getDailyReport, getWeeklyReport };