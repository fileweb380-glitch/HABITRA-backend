
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const FRONTEND_BASE_URL = (
  process.env.FRONTEND_URL || 'https://habitra-abdu2.vercel.app'
).replace(/\/+$/, '');

const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa';

const normalizeEmail = (email) =>
  String(email || '').trim().toLowerCase();

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

const buildFrontendUrl = (path, params = {}) => {
  const url = new URL(path, `${FRONTEND_BASE_URL}/`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  return url.toString();
};

// ==========================================
// SEND VERIFICATION EMAIL WITH NODEMAILER
// ==========================================

const sendVerificationEmail = async (user, verificationToken) => {
  const verifyUrl = buildFrontendUrl('/verify-email', {
    token: verificationToken,
    email: user.email
  });

  await sendEmail({
    email: user.email,
    subject: 'Verify Your HABITRA Account',

    message: `
Welcome to HABITRA, ${user.name}!

Please verify your email address using this link:

${verifyUrl}

This link expires in 24 hours.

If you did not create this account, you can ignore this email.
    `,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:25px;color:#26352d;">
        <h2 style="color:#174C38;">Welcome to HABITRA!</h2>

        <p>Hello ${user.name},</p>

        <p>Thank you for creating your HABITRA account.</p>

        <p>Please verify your email address to activate your account.</p>

        <a
          href="${verifyUrl}"
          style="display:inline-block;padding:13px 24px;background:#174C38;color:white;text-decoration:none;border-radius:7px;"
        >
          Verify Email Address
        </a>

        <p style="margin-top:25px;font-size:13px;color:#777;">
          This link expires in 24 hours.
        </p>

        <p style="font-size:13px;color:#777;">
          If you did not create this account, you can ignore this email.
        </p>
      </div>
    `
  });
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

  if (String(name).trim().length < 2) {
    throw createError(
      'Name must contain at least 2 characters.',
      400
    );
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw createError(
      'An account with this email already exists.',
      409
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = new User({
    name: String(name).trim(),
    email,
    passwordHash,
    timezone: timezone || DEFAULT_TIMEZONE,
    isVerified: false
  });

  // Generate and save the hashed verification token.
  const verificationToken = user.getVerificationToken();

  await user.save();

  // If email delivery fails, keep the account.
  // The user can request another verification email.
  let verificationEmailSent = false;

  try {
    await sendVerificationEmail(user, verificationToken);
    verificationEmailSent = true;

    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error(
      'Nodemailer verification error:',
      error.message
    );
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    isVerified: false,
    verificationEmailSent,
    message: verificationEmailSent
      ? 'Account created. Please check your email to verify your account.'
      : 'Account created, but the email could not be sent. Please use resend verification.'
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

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    email: normalizeEmail(email),
    verificationToken: hashedToken,
    verificationTokenExpires: { $gt: new Date() }
  });

  if (!user) {
    throw createError(
      'Invalid or expired verification link. Please request another email.',
      400
    );
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;

  await user.save();

  return {
    success: true,
    message: 'Email successfully verified! Your HABITRA account is now active.'
  };
};

// ==========================================
// RESEND VERIFICATION EMAIL
// ==========================================

const resendVerificationEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createError('Email is required.', 400);
  }

  const genericResponse = {
    success: true,
    message: 'If an unverified account exists, a verification email will be sent.'
  };

  const user = await User.findOne({
    email: normalizedEmail
  });

  if (!user || user.isVerified) {
    return genericResponse;
  }

  // Generate a fresh token and invalidate the previous one.
  const verificationToken = user.getVerificationToken();

  await user.save();

  try {
    await sendVerificationEmail(user, verificationToken);

    console.log(
      `New verification email sent to ${normalizedEmail}`
    );
  } catch (error) {
    console.error(
      'Resend verification email failed:',
      error.message
    );

    throw createError(
      'Unable to send verification email. Please try again later.',
      503
    );
  }

  return genericResponse;
};

// ==========================================
// FORGOT PASSWORD
// ==========================================

const forgotPassword = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createError('Email is required.', 400);
  }

  const genericResponse = {
    message: 'If an account exists with that email, a password reset link will be sent.'
  };

  const user = await User.findOne({
    email: normalizedEmail
  });

  if (!user) {
    return genericResponse;
  }

  const resetToken = user.getResetPasswordToken();

  await user.save();

  const resetUrl = buildFrontendUrl('/reset-password', {
    token: resetToken
  });

  try {
    await sendEmail({
      email: user.email,
      subject: 'HABITRA Password Reset',

      message: `
You requested a password reset.

Use this link to reset your HABITRA password:

${resetUrl}

This link expires in 10 minutes.
      `,

      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <h2>Reset Your HABITRA Password</h2>

          <p>You requested a password reset.</p>

          <a
            href="${resetUrl}"
            style="display:inline-block;padding:12px 22px;background:#174C38;color:white;text-decoration:none;border-radius:6px;"
          >
            Reset Password
          </a>

          <p>This link expires in 10 minutes.</p>
        </div>
      `
    });
  } catch (error) {
    console.error(
      'Password reset email failed:',
      error.message
    );

    throw createError(
      'Unable to send password reset email.',
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
    success: true,
    message: 'Password reset successfully!'
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

  if (!user.isVerified) {
    throw createError(
      'Please verify your email before signing in. Check your inbox or request a new verification email.',
      403
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

module.exports = {
  register,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  login
};
