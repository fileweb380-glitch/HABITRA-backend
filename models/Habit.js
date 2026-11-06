const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  recurrence: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Habit', habitSchema);