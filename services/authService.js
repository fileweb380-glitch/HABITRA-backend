const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const register = async ({ name, email, password, timezone }) => {
  if (!name || !email || !password) {
    throw new AppError('Please provide all required fields', 400);
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError('User already exists', 400);
  }
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    email,
    passwordHash,
    timezone: timezone || 'Africa/Addis_Ababa',
    isVerified: true
  });

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    token: generateToken(user._id)
  };
};

const login = async ({ email, password }) => {
  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }
  const user = await User.findOne({ email });
  if (user && (await bcrypt.compare(password, user.passwordHash))) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      token: generateToken(user._id)
    };
  }
  throw new AppError('Invalid email or password', 401);
};

module.exports = { register, login };