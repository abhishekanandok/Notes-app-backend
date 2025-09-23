const folderService = require('../services/folderService');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all folders
// @route   GET /api/folders
// @access  Private
const getAllFolders = asyncHandler(async (req, res) => {
  const result = await folderService.getAllFolders(req.user.id);
  res.status(200).json(result);
});

// @desc    Get single folder
// @route   GET /api/folders/:id
// @access  Private
const getFolderById = asyncHandler(async (req, res) => {
  const result = await folderService.getFolderById(req.params.id, req.user.id);
  res.status(200).json(result);
});

// @desc    Create new folder
// @route   POST /api/folders
// @access  Private
const createFolder = asyncHandler(async (req, res) => {
  const result = await folderService.createFolder(req.body, req.user.id);
  res.status(201).json(result);
});

// @desc    Update folder
// @route   PUT /api/folders/:id
// @access  Private
const updateFolder = asyncHandler(async (req, res) => {
  const result = await folderService.updateFolder(req.params.id, req.body, req.user.id);
  res.status(200).json(result);
});

// @desc    Delete folder
// @route   DELETE /api/folders/:id
// @access  Private
const deleteFolder = asyncHandler(async (req, res) => {
  const result = await folderService.deleteFolder(req.params.id, req.user.id);
  res.status(200).json(result);
});

module.exports = {
  getAllFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder
};
