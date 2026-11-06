const Commitment = require('../models/Commitment');

const reportService = {
  calculateDailyMetrics: async (userId, date) => {
    const commitments = await Commitment.find({ owner: userId, scheduledDate: date });
    const totalEligible = commitments.filter(c => c.status !== 'Cancelled').length;
    const completedCount = commitments.filter(c => c.status === 'Completed').length;
    return {
      totalEligible,
      completedCount,
      rate: totalEligible > 0 ? Math.round((completedCount / totalEligible) * 100) : 0
    };
  }
};

module.exports = reportService;