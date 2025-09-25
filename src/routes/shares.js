const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  shareNote,
  getNoteShares,
  removeNoteShare,
  getSharedNotes
} = require('../controllers/shareController');

// All routes are protected
router.use(protect);

// @route   GET /api/shares/notes
// @desc    Get notes shared with current user
router.get('/notes', getSharedNotes);

// @route   POST /api/shares/notes/:id
// @desc    Share note with user
router.post('/notes/:id', shareNote);

// @route   GET /api/shares/notes/:id
// @desc    Get note shares
router.get('/notes/:id', getNoteShares);

// @route   DELETE /api/shares/notes/:id/:username
// @desc    Remove note share
router.delete('/notes/:id/:username', removeNoteShare);

module.exports = router;
