const authService = require('../services/authService');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  
  res.status(201).json(result);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  
  res.status(200).json(result);
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const result = await authService.getMe(req.user.id);
  
  res.status(200).json(result);
});

module.exports = {
  register,
  login,
  getMe
};
