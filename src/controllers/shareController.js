const prisma = require('../config/database');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Share note with user
// @route   POST /api/notes/:id/share
// @access  Private (Owner only)
const shareNote = asyncHandler(async (req, res) => {
  const { username, role = 'viewer' } = req.body;
  const noteId = req.params.id;

  // Verify note ownership
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: req.user.id }
  });

  if (!note) {
    return res.status(404).json({
      success: false,
      error: 'Note not found or access denied'
    });
  }

  // Check if user exists
  const targetUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, email: true }
  });

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Prevent sharing with yourself
  if (targetUser.id === req.user.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot share note with yourself'
    });
  }

  // Create or update share
  const share = await prisma.noteShare.upsert({
    where: {
      noteId_userId: {
        noteId,
        userId: targetUser.id
      }
    },
    update: { role },
    create: {
      noteId,
      userId: targetUser.id,
      role
    },
    include: {
      user: {
        select: { id: true, username: true, email: true }
      }
    }
  });

  res.status(200).json({
    success: true,
    data: share
  });
});

// @desc    Get note shares
// @route   GET /api/notes/:id/shares
// @access  Private (Owner only)
const getNoteShares = asyncHandler(async (req, res) => {
  const noteId = req.params.id;

  // Verify note ownership
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: req.user.id }
  });

  if (!note) {
    return res.status(404).json({
      success: false,
      error: 'Note not found or access denied'
    });
  }

  const shares = await prisma.noteShare.findMany({
    where: { noteId },
    include: {
      user: {
        select: { id: true, username: true, email: true }
      }
    }
  });

  res.status(200).json({
    success: true,
    data: shares
  });
});

// @desc    Remove note share
// @route   DELETE /api/notes/:id/share/:username
// @access  Private (Owner only)
const removeNoteShare = asyncHandler(async (req, res) => {
  const { id: noteId, username } = req.params;

  // Verify note ownership
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId: req.user.id }
  });

  if (!note) {
    return res.status(404).json({
      success: false,
      error: 'Note not found or access denied'
    });
  }

  // Find the user by username
  const targetUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true }
  });

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  await prisma.noteShare.delete({
    where: {
      noteId_userId: {
        noteId,
        userId: targetUser.id
      }
    }
  });

  res.status(200).json({
    success: true,
    message: 'Share removed successfully'
  });
});

// @desc    Get shared notes (notes shared with current user)
// @route   GET /api/notes/shared
// @access  Private
const getSharedNotes = asyncHandler(async (req, res) => {
  const sharedNotes = await prisma.noteShare.findMany({
    where: { userId: req.user.id },
    include: {
      note: {
        include: {
          user: {
            select: { id: true, username: true, email: true }
          }
        }
      }
    }
  });

  res.status(200).json({
    success: true,
    data: sharedNotes.map(share => ({
      ...share.note,
      shareRole: share.role,
      sharedBy: share.note.user
    }))
  });
});

module.exports = {
  shareNote,
  getNoteShares,
  removeNoteShare,
  getSharedNotes
};
