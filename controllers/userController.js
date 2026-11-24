const User = require('../models/User');
const Commitment = require('../models/Commitment');
const Habit = require('../models/Habit');
const Goal = require('../models/Goal');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

// @desc    Update user profile and system preferences
// @route   PATCH /api/users/profile
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, email, startOfDay, timezone, reminderPref, treatmentMode } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (fullName) user.name = fullName;
  if (email) user.email = email;
  if (startOfDay) user.startOfDay = startOfDay;
  if (timezone) user.timezone = timezone;
  if (reminderPref) user.reminderPref = reminderPref;
  if (treatmentMode) user.treatmentMode = treatmentMode;

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    name: updatedUser.name,
    fullName: updatedUser.name,
    email: updatedUser.email,
    startOfDay: updatedUser.startOfDay,
    timezone: updatedUser.timezone,
    reminderPref: updatedUser.reminderPref,
    treatmentMode: updatedUser.treatmentMode
  });
});

// @desc    Change user password securely
// @route   POST /api/users/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide both current and new passwords', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters long', 400);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Incorrect current password', 401);
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  await user.save();

  res.json({ message: 'Password updated securely' });
});

// @desc    Delete user account and all associated data
// @route   DELETE /api/users/account
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Clean up user data
  await Commitment.deleteMany({ owner: userId });
  await Habit.deleteMany({ user: userId });
  await Goal.deleteMany({ owner: userId });
  await User.findByIdAndDelete(userId);

  res.json({ message: 'Account and associated data deleted successfully' });
});

module.exports = { updateProfile, changePassword, deleteAccount };