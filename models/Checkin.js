const mongoose = require('mongoose');

const checkinSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  commitment: { type: mongoose.Schema.Types.ObjectId, ref: 'Commitment', required: true, index: true },
  commitmentDate: { type: String, required: true },
  response: { type: String, enum: ['Completed', 'Missed', 'Unconfirmed'], required: true },
  reasonCode: {
    type: String,
    enum: ['forgot', 'urgent', 'out_of_time', 'unmotivated', 'other', null],
    default: null
  },
  explanation: { type: String, trim: true },
  respondedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Checkin', checkinSchema);