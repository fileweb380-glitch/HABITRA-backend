const mongoose = require('mongoose');

const commitmentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal' },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  scheduledDate: { type: String, required: true, index: true }, // YYYY-MM-DD
  startTime: { type: String }, // HH:mm or null
  isFlexible: { type: Boolean, default: false },
  durationMinutes: { type: Number, required: true, default: 30 },
  status: {
    type: String,
    enum: ['Scheduled', 'In progress', 'Completed', 'Missed', 'Unconfirmed', 'Rescheduled', 'Cancelled'],
    default: 'Scheduled'
  },
  reminderPreferences: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    minutesBefore: { type: Number, default: 15 }
  },
  originalSchedule: {
    scheduledDate: { type: String },
    startTime: { type: String }
  },
  rescheduleHistory: [{
    previousDate: String,
    previousStartTime: String,
    rescheduledAt: { type: Date, default: Date.now }
  }],
  completedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Commitment', commitmentSchema);