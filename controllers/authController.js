

const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

// REGISTER
const registerUser = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

// LOGIN
const loginUser = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

// FORGOT PASSWORD
const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(
    req.body.email
  );

  res.json(result);
});

// RESET PASSWORD
const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(
    req.body.token,
    req.body.password
  );

  res.json(result);
});

// GET CURRENT USER
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

module.exports = {
  registerUser,
  forgotPassword,
  resetPassword,
  loginUser,
  getMe
};
