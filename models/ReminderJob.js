const mongoose = require('mongoose');

const reminderJobSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  commitment: { type: mongoose.Schema.Types.ObjectId, ref: 'Commitment', required: true },
  channel: { type: String, enum: ['email', 'push'], required: true },
  scheduledFor: { type: Date, required: true, index: true },
  idempotencyKey: { type: String, required: true, unique: true },
  state: { type: String, enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'], default: 'pending' },
  retryCount: { type: Number, default: 0 },
  errorLog: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ReminderJob', reminderJobSchema);