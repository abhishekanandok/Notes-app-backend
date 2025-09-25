const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { searchUsers } = require('../controllers/userController');

// All routes are protected
router.use(protect);

// @route   GET /api/users/search
// @desc    Search users by username or email
router.get('/search', searchUsers);

module.exports = router;
