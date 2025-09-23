const noteService = require('../services/noteService');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all notes
// @route   GET /api/notes
// @access  Private
const getAllNotes = asyncHandler(async (req, res) => {
  const result = await noteService.getAllNotes(req.user.id);
  res.status(200).json(result);
});

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Private
const getNoteById = asyncHandler(async (req, res) => {
  const result = await noteService.getNoteById(req.params.id, req.user.id);
  res.status(200).json(result);
});

// @desc    Create new note
// @route   POST /api/notes
// @access  Private
const createNote = asyncHandler(async (req, res) => {
  const result = await noteService.createNote(req.body, req.user.id);
  res.status(201).json(result);
});

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private
const updateNote = asyncHandler(async (req, res) => {
  const result = await noteService.updateNote(req.params.id, req.body, req.user.id);
  res.status(200).json(result);
});

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private
const deleteNote = asyncHandler(async (req, res) => {
  const result = await noteService.deleteNote(req.params.id, req.user.id);
  res.status(200).json(result);
});

module.exports = {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote
};
