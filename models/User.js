const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  startOfDay: { type: String, default: '08:00' },
  timezone: { type: String, default: 'Africa/Addis_Ababa' },
  reminderPref: { type: String, enum: ['both', 'email', 'push', 'none'], default: 'both' },
  treatmentMode: { type: String, enum: ['command', 'positive', 'calm'], default: 'command' },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  preferences: {
    emailReminders: { type: Boolean, default: true },
    pushReminders: { type: Boolean, default: true },
    gracePeriodMinutes: { type: Number, default: 10 },
    pushSubscription: { type: Object, default: null }
  }
}, { timestamps: true });

// Generate Email Verification Token
userSchema.methods.getVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};

// Generate Password Reset Token
userSchema.methods.getResetPasswordToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);