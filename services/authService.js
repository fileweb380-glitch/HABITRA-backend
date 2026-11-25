const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==========================================
// CONFIGURATION
// ==========================================

const FRONTEND_BASE_URL = (
  process.env.FRONTEND_URL || 'https://habitra-l863u5795-abdu2.vercel.app'
).replace(/\/+$/, '');

const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa';

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const normalizeEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};

const buildFrontendUrl = (path, params = {}) => {
  const url = new URL(path, `${FRONTEND_BASE_URL}/`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  return url.toString();
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ==========================================
// REGISTER
// ==========================================

const register = async (body) => {
  const { name, password, timezone } = body;
  const email = normalizeEmail(body.email);

  if (!name || !email || !password) {
    throw createError(
      'Name, email, and password are required.',
      400
    );
  }

  if (password.length < 8) {
    throw createError(
      'Password must contain at least 8 characters.',
      400
    );
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw createError('User already exists.', 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = new User({
    name: String(name).trim(),
    email,
    passwordHash,
    timezone: timezone || DEFAULT_TIMEZONE,
    isVerified: false
  });

  const verificationToken = user.getVerificationToken();

  await user.save();

  const verifyUrl = buildFrontendUrl('/verify-email', {
    token: verificationToken,
    email: user.email
  });

  const message = `
Welcome to HABITRA!

Please verify your email address using the following link:

${verifyUrl}
`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2>Welcome to HABITRA!</h2>
      <p>Thank you for creating your account.</p>
      <p>Please verify your email address to activate your account.</p>
      <a href="${verifyUrl}"
         style="display:inline-block;padding:12px 22px;background:#174C38;color:#fff;text-decoration:none;border-radius:6px;">
        Verify Email
      </a>
      <p>If you did not create this account, you can ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Verify Your HABITRA Account',
      message,
      html
    });
  } catch (err) {
    console.error('Registration verification email failed:', err.message);
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    token: generateToken(user._id),
    message: 'Registration successful. Please check your email to verify your account.'
  };
};

// ==========================================
// VERIFY EMAIL
// ==========================================

const verifyEmail = async (token, email) => {
  if (!token || !email) {
    throw createError(
      'Verification token and email are required.',
      400
    );
  }

  const normalizedEmail = normalizeEmail(email);

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    email: normalizedEmail,
    verificationToken: hashedToken,
    verificationTokenExpires: { $gt: new Date() }
  });

  if (!user) {
    throw createError(
      'Invalid or expired verification token.',
      400
    );
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;

  await user.save();

  return {
    message: 'Email successfully verified! Your account is now active.'
  };
};

// ==========================================
// RESEND VERIFICATION EMAIL
// ==========================================

const resendVerificationEmail = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw createError('User not found.', 404);
  }

  if (user.isVerified) {
    throw createError('Your account is already verified.', 400);
  }

  const verificationToken = user.getVerificationToken();

  await user.save();

  const verifyUrl = buildFrontendUrl('/verify-email', {
    token: verificationToken,
    email: user.email
  });

  const message = `
Please verify your HABITRA account using this link:

${verifyUrl}
`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2>Verify Your HABITRA Account</h2>
      <p>You requested a new verification link.</p>
      <a href="${verifyUrl}"
         style="display:inline-block;padding:12px 22px;background:#174C38;color:#fff;text-decoration:none;border-radius:6px;">
        Verify Email
      </a>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'HABITRA Email Verification',
      message,
      html
    });
  } catch (err) {
    console.error('Resend verification email failed:', err.message);
    throw createError(
      'Unable to send verification email. Please try again later.',
      503
    );
  }

  return {
    message: 'Verification email sent. Please check your inbox and spam folder.'
  };
};

// ==========================================
// FORGOT PASSWORD
// ==========================================

const forgotPassword = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createError('Email is required.', 400);
  }

  const user = await User.findOne({
    email: normalizedEmail
  });

  // Generic response prevents account enumeration.
  const genericResponse = {
    message: 'If an account exists with that email, a password reset link will be sent.'
  };

  if (!user) {
    return genericResponse;
  }

  const resetToken = user.getResetPasswordToken();

  await user.save();

  const resetUrl = buildFrontendUrl('/reset-password', {
    token: resetToken
  });

  const message = `
You requested a password reset for your HABITRA account.

Use the following link to reset your password:

${resetUrl}

This link expires in 10 minutes.
`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2>Reset Your Password</h2>
      <p>You requested a password reset for your HABITRA account.</p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:12px 22px;background:#174C38;color:#fff;text-decoration:none;border-radius:6px;">
        Reset Password
      </a>
      <p>This link expires in 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: 'HABITRA Password Reset',
      message,
      html
    });
  } catch (err) {
    console.error('Password reset email failed:', err.message);
    throw createError(
      'Unable to send password reset email. Please try again later.',
      503
    );
  }

  return genericResponse;
};

// ==========================================
// RESET PASSWORD
// ==========================================

const resetPassword = async (token, newPassword) => {
  if (!token || !newPassword) {
    throw createError(
      'Reset token and new password are required.',
      400
    );
  }

  if (newPassword.length < 8) {
    throw createError(
      'Password must contain at least 8 characters.',
      400
    );
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() }
  });

  if (!user) {
    throw createError(
      'Invalid or expired password reset token.',
      400
    );
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);

  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  return {
    message: 'Password reset successfully! You can now log in with your new password.'
  };
};

// ==========================================
// LOGIN
// ==========================================

const login = async (body) => {
  const email = normalizeEmail(body.email);
  const { password } = body;

  if (!email || !password) {
    throw createError(
      'Email and password are required.',
      400
    );
  }

  const user = await User.findOne({ email });

  if (
    !user ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    throw createError(
      'Invalid email or password.',
      401
    );
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    token: generateToken(user._id)
  };
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  register,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  login
};
