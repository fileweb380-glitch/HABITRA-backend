const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const register = async (body) => {
  const { name, email, password, timezone } = body;
  
  let user = await User.findOne({ email });
  if (user) {
    const error = new Error('User already exists');
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Default isVerified to false so true verification flow takes place
  user = new User({ 
    name, 
    email, 
    passwordHash, 
    timezone: timezone || 'Africa/Addis_Ababa',
    isVerified: false 
  });
  
  const verificationToken = user.getVerificationToken();
  await user.save();

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${user.email}`;
  
  console.log('\n==================================================');
  console.log('🔗 HABITRA VERIFICATION LINK:');
  console.log(verifyUrl);
  console.log('==================================================\n');

  const message = `Welcome to HABITRA! Please verify your account here: ${verifyUrl}`;
  const html = `<p>Welcome to HABITRA! Click <a href="${verifyUrl}">here</a> to verify your account.</p>`;

  try {
    await sendEmail({ email: user.email, subject: 'Account Verification - HABITRA', message, html });
  } catch (err) {
    console.warn('Warning: SMTP Email dispatch failed during registration, but bypassing for local testing:', err.message);
  }

  // Returns JWT so user can land on onboarding/dashboard immediately as unverified
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    token: generateToken(user._id),
    message: 'Registration successful! Please check your email to verify your account.'
  };
};

const verifyEmail = async (token, email) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    email,
    verificationToken: hashedToken,
    verificationTokenExpires: { $gt: Date.now() }
  });

  if (!user) {
    const error = new Error('Invalid or expired verification token');
    error.statusCode = 400;
    throw error;
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  return { message: 'Email successfully verified! Your account is fully active.' };
};

const resendVerificationEmail = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.isVerified) {
    const error = new Error('Account is already verified');
    error.statusCode = 400;
    throw error;
  }

  const verificationToken = user.getVerificationToken();
  await user.save();

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}&email=${user.email}`;

  console.log('\n==================================================');
  console.log('🔗 RESENT HABITRA VERIFICATION LINK:');
  console.log(verifyUrl);
  console.log('==================================================\n');

  const message = `Please verify your HABITRA account using this link: ${verifyUrl}`;
  const html = `<p>Click <a href="${verifyUrl}">here</a> to verify your HABITRA account.</p>`;

  try {
    await sendEmail({ email: user.email, subject: 'Account Verification - HABITRA', message, html });
  } catch (err) {
    console.warn('Warning: SMTP Email dispatch failed for resending verification, but bypass link is available in terminal:', err.message);
  }

  return { message: 'Verification link generated successfully! Check your backend terminal.' };
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error('No account found with that email');
    error.statusCode = 404;
    throw error;
  }

  const resetToken = user.getResetPasswordToken();
  await user.save();

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  console.log('\n==================================================');
  console.log('🔗 HABITRA PASSWORD RESET LINK:');
  console.log(resetUrl);
  console.log('==================================================\n');

  const message = `You requested a password reset. Click here: ${resetUrl}`;
  const html = `<p>Reset your password by clicking <a href="${resetUrl}">here</a>. Expires in 10 minutes.</p>`;

  try {
    await sendEmail({ email: user.email, subject: 'Password Reset - HABITRA', message, html });
  } catch (err) {
    console.warn('Warning: SMTP Email dispatch failed for password reset, but bypass link is available in terminal:', err.message);
  }

  return { message: 'Password reset link generated successfully! Check your backend terminal.' };
};

const resetPassword = async (token, newPassword) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    const error = new Error('Invalid or expired password reset token');
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return { message: 'Password reset successfully!' };
};

const login = async (body) => {
  const { email, password } = body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    token: generateToken(user._id)
  };
};

module.exports = { 
  register, 
  verifyEmail, 
  resendVerificationEmail,
  forgotPassword, 
  resetPassword, 
  login 
};