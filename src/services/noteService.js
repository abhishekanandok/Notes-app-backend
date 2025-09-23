const prisma = require('../config/database');

const getAllNotes = async (userId) => {
  const notes = await prisma.note.findMany({
    where: { userId },
    include: {
      folder: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return {
    success: true,
    count: notes.length,
    data: notes
  };
};

const getNoteById = async (id, userId) => {
  const note = await prisma.note.findFirst({
    where: {
      id,
      userId
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!note) {
    throw new Error('Note not found');
  }

  return {
    success: true,
    data: note
  };
};

const createNote = async (noteData, userId) => {
  const { title, content, folderId } = noteData;

  // Verify folder belongs to user if folderId is provided
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId
      }
    });

    if (!folder) {
      throw new Error('Folder not found or access denied');
    }
  }

  const note = await prisma.note.create({
    data: {
      title,
      content: content || '',
      userId,
      folderId: folderId || null
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return {
    success: true,
    data: note
  };
};

const updateNote = async (id, noteData, userId) => {
  const { title, content, folderId } = noteData;

  // Check if note exists and belongs to user
  const existingNote = await prisma.note.findFirst({
    where: {
      id,
      userId
    }
  });

  if (!existingNote) {
    throw new Error('Note not found or access denied');
  }

  // Verify folder belongs to user if folderId is provided
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId
      }
    });

    if (!folder) {
      throw new Error('Folder not found or access denied');
    }
  }

  const note = await prisma.note.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(content !== undefined && { content }),
      ...(folderId !== undefined && { folderId: folderId || null })
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return {
    success: true,
    data: note
  };
};

const deleteNote = async (id, userId) => {
  // Check if note exists and belongs to user
  const note = await prisma.note.findFirst({
    where: {
      id,
      userId
    }
  });

  if (!note) {
    throw new Error('Note not found or access denied');
  }

  await prisma.note.delete({
    where: { id }
  });

  return {
    success: true,
    data: {}
  };
};

module.exports = {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote
};
