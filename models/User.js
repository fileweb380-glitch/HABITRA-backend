
const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  passwordHash: {
    type: String,
    required: true
  },

  startOfDay: {
    type: String,
    default: '08:00'
  },

  timezone: {
    type: String,
    default: 'Africa/Addis_Ababa'
  },

  reminderPref: {
    type: String,
    enum: ['both', 'email', 'push', 'none'],
    default: 'both'
  },

  treatmentMode: {
    type: String,
    enum: ['command', 'positive', 'calm'],
    default: 'command'
  },

  // Email verification is temporarily disabled.
  isVerified: {
    type: Boolean,
    default: true
  },

  // Password reset fields
  resetPasswordToken: {
    type: String
  },

  resetPasswordExpires: {
    type: Date
  },

  preferences: {
    emailReminders: {
      type: Boolean,
      default: true
    },

    pushReminders: {
      type: Boolean,
      default: true
    },

    gracePeriodMinutes: {
      type: Number,
      default: 10
    },

    pushSubscription: {
      type: Object,
      default: null
    }
  }

}, { timestamps: true });

// Generate Password Reset Token
userSchema.methods.getResetPasswordToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.resetPasswordExpires =
    Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
