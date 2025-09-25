const prisma = require('../config/database');

const verifyNoteAccess = async (noteId, userId) => {
  // First check if user owns the note
  const ownedNote = await prisma.note.findFirst({
    where: {
      id: noteId,
      userId
    }
  });

  if (ownedNote) {
    return { note: ownedNote, userRole: 'owner' };
  }

  // Check if user has access through sharing
  const sharedNote = await prisma.note.findFirst({
    where: {
      id: noteId,
      shares: {
        some: {
          userId
        }
      }
    },
    include: {
      shares: {
        where: {
          userId
        }
      }
    }
  });

  if (sharedNote) {
    const share = sharedNote.shares[0];
    return { note: sharedNote, userRole: share.role };
  }

  throw new Error('Note not found or access denied');
};

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
  
  const { note, userRole } = await verifyNoteAccess(id, userId);

  // Get additional folder info
  const noteWithFolder = await prisma.note.findUnique({
    where: { id },
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
    data: {
      ...noteWithFolder,
      userRole
    }
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

  // Use auth middleware helper for consistent access verification
  const { note: existingNote, userRole } = await verifyNoteAccess(id, userId);

  // Check if user has edit permissions
  if (userRole === 'viewer') {
    throw new Error('Viewer role cannot edit notes');
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
  verifyNoteAccess,
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote
};
