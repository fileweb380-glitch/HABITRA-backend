const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

const registerUser = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token, email } = req.query;
  const result = await authService.verifyEmail(token, email);
  res.json(result);
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
  const result = await authService.resendVerificationEmail(req.user._id);
  res.json(result);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  res.json(result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await authService.resetPassword(token, password);
  res.json(result);
});

const loginUser = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

module.exports = { 
  registerUser, 
  verifyEmail, 
  resendVerificationEmail,
  forgotPassword, 
  resetPassword, 
  loginUser, 
  getMe 
};