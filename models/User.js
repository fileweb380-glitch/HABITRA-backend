const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  timezone: { type: String, default: 'Africa/Addis_Ababa' },
  preferences: {
    emailReminders: { type: Boolean, default: true },
    pushReminders: { type: Boolean, default: true },
    gracePeriodMinutes: { type: Number, default: 10 }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);