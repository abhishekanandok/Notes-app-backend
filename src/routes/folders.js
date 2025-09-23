const express = require('express');
const {
  getAllFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder
} = require('../controllers/folderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect); // Protect all routes

router.route('/')
  .get(getAllFolders)
  .post(createFolder);

router.route('/:id')
  .get(getFolderById)
  .put(updateFolder)
  .delete(deleteFolder);

module.exports = router;
