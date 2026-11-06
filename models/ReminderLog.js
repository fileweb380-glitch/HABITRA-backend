const mongoose = require('mongoose');

const reminderLogSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'ReminderJob', required: true },
  attemptNumber: { type: Number, required: true },
  providerResult: { type: String },
  errorCategory: { type: String },
  success: { type: Boolean, required: true }
}, { timestamps: true });

module.exports = mongoose.model('ReminderLog', reminderLogSchema);