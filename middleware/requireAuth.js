
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError('Not authorized, no token provided', 401)
    );
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next(
      new AppError('Not authorized, no token provided', 401)
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id)
      .select('-passwordHash');

    if (!user) {
      return next(
        new AppError('User not found for this token', 401)
      );
    }

    req.user = user;

    return next();

  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    return next(
      new AppError('Not authorized, token failed', 401)
    );
  }
});

module.exports = requireAuth;
