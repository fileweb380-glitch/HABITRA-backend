const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: 'Personal projects'
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'daily'
  },
  // For weekly habits (e.g., ['Mon', 'Wed', 'Fri'])
  days: {
    type: [String],
    default: []
  },
  // For monthly habits (e.g., day 1 to 31)
  monthlyDate: {
    type: Number
  },
  // For yearly habits (stored as object { month, day } or string)
  yearlyDate: {
    type: mongoose.Schema.Types.Mixed
  },
  time: {
    type: String, // Format: "HH:MM" (e.g., "08:00")
    required: true
  },
  durationMinutes: {
    type: Number,
    default: 30
  },
  reminderPref: {
    type: String,
    enum: ['both', 'email', 'push', 'none'],
    default: 'both'
  },
  status: {
    type: String,
    enum: ['active', 'paused'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Habit', habitSchema);