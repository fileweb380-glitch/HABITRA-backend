const mongoose = require('mongoose');

const weeklyReflectionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  weekIdentifier: { type: String, required: true }, // e.g. "2026-W45" or date string
  wentWell: { type: String, trim: true },
  struggledWith: { type: String, trim: true },
  accomplishments: { type: String, trim: true },
  improve: { type: String, trim: true },
  priorities: { type: String, trim: true }
}, { timestamps: true });

// Ensure one reflection per user per week identifier
weeklyReflectionSchema.index({ owner: 1, weekIdentifier: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyReflection', weeklyReflectionSchema);