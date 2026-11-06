const mongoose = require('mongoose');

const dailyReviewSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  reflection: { type: String, trim: true },
  completedCount: { type: Number, default: 0 },
  missedCount: { type: Number, default: 0 },
  totalEligible: { type: Number, default: 0 }
}, { timestamps: true });

dailyReviewSchema.index({ owner: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyReview', dailyReviewSchema);