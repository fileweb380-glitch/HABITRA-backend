const mongoose = require('mongoose');

const habitEntrySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  habit: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  outcome: { type: String, enum: ['Completed', 'Missed', 'Skipped'], default: 'Completed' },
  quantity: { type: Number },
  note: { type: String, trim: true }
}, { timestamps: true });

habitEntrySchema.index({ owner: 1, habit: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('HabitEntry', habitEntrySchema);