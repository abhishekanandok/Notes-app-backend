const prisma = require('../config/database');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Search users by username or email
// @route   GET /api/users/search
// @access  Private
const searchUsers = asyncHandler(async (req, res) => {
  const { q: query } = req.query;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Query must be at least 2 characters long'
    });
  }

  const searchTerm = query.trim();

  // Search users by username or email (case insensitive)
  const users = await prisma.user.findMany({
    where: {
      OR: [
        {
          username: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          email: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      ],
      // Exclude current user from search results
      id: {
        not: req.user.id
      }
    },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      updatedAt: true
    },
    take: 20, // Limit results to 20 users
    orderBy: {
      username: 'asc'
    }
  });

  res.status(200).json({
    success: true,
    count: users.length,
    data: users
  });
});

module.exports = {
  searchUsers
};
