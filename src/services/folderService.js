const prisma = require('../config/database');

const getAllFolders = async (userId) => {
  const folders = await prisma.folder.findMany({
    where: { userId },
    include: {
      _count: {
        select: {
          notes: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return {
    success: true,
    count: folders.length,
    data: folders
  };
};

const getFolderById = async (id, userId) => {
  const folder = await prisma.folder.findFirst({
    where: {
      id,
      userId
    },
    include: {
      notes: {
        orderBy: { updatedAt: 'desc' }
      },
      _count: {
        select: {
          notes: true
        }
      }
    }
  });

  if (!folder) {
    throw new Error('Folder not found');
  }

  return {
    success: true,
    data: folder
  };
};

const createFolder = async (folderData, userId) => {
  const { name, description } = folderData;

  const folder = await prisma.folder.create({
    data: {
      name,
      description: description || null,
      userId
    },
    include: {
      _count: {
        select: {
          notes: true
        }
      }
    }
  });

  return {
    success: true,
    data: folder
  };
};

const updateFolder = async (id, folderData, userId) => {
  const { name, description } = folderData;

  // Check if folder exists and belongs to user
  const existingFolder = await prisma.folder.findFirst({
    where: {
      id,
      userId
    }
  });

  if (!existingFolder) {
    throw new Error('Folder not found or access denied');
  }

  const folder = await prisma.folder.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description: description || null })
    },
    include: {
      _count: {
        select: {
          notes: true
        }
      }
    }
  });

  return {
    success: true,
    data: folder
  };
};

const deleteFolder = async (id, userId) => {
  // Check if folder exists and belongs to user
  const folder = await prisma.folder.findFirst({
    where: {
      id,
      userId
    }
  });

  if (!folder) {
    throw new Error('Folder not found or access denied');
  }

  // Move all notes in this folder to null (no folder)
  await prisma.note.updateMany({
    where: {
      folderId: id,
      userId
    },
    data: {
      folderId: null
    }
  });

  // Delete the folder
  await prisma.folder.delete({
    where: { id }
  });

  return {
    success: true,
    data: {}
  };
};

module.exports = {
  getAllFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder
};
