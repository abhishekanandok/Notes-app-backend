const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/database');
const { verifyNoteAccess } = require('../services/noteService');

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.rooms = new Map(); // Map<noteId, Set<WebSocket>>
    this.typingUsers = new Map(); // Map<noteId, Map<userId, {username, timestamp}>>
    this.autoSaveTimers = new Map(); // Map<noteId, timer>
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      verifyClient: (info) => {
        // Allow all connections, we'll handle auth in the connection handler
        return true;
      }
    });

    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection attempt');
      console.log('Request URL:', req.url);
      console.log('Request headers:', req.headers);

      // Extract note ID from URL path
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/').filter(part => part !== '');
      
      // Check if path starts with ws/notes and extract note ID
      if (pathParts.length < 3 || pathParts[0] !== 'ws' || pathParts[1] !== 'notes') {
        console.log('Invalid WebSocket path, closing connection');
        ws.close(1008, 'Invalid path');
        return;
      }
      
      const noteId = pathParts[2];

      console.log('Extracted note ID:', noteId);

      if (!noteId) {
        console.log('No note ID found, closing connection');
        ws.close(1008, 'Note ID required');
        return;
      }

      // Authenticate user
      this.authenticateUser(ws, req, noteId);
    });

    console.log(`WebSocket server initialized on path /ws/notes`);
  }

  async authenticateUser(ws, req, noteId) {
    try {
      // Extract token from query params or headers
      const token = req.url.split('token=')[1]?.split('&')[0] || 
                   req.headers.authorization?.split(' ')[1];

      console.log('Extracted token:', token ? 'Token present' : 'No token');

      if (!token) {
        console.log('No token found, closing connection');
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, email: true }
      });

      if (!user) {
        ws.close(1008, 'User not found');
        return;
      }

      // Verify user has access to the note (owner or shared)
      const { note, userRole } = await verifyNoteAccess(noteId, user.id);

      // Store user info on websocket
      ws.userId = user.id;
      ws.username = user.username;
      ws.noteId = noteId;

      // Add to room
      this.joinRoom(ws, noteId);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: `Connected to note: ${note.title}`,
        user: { id: user.id, username: user.username }
      }));

      // Notify others in the room
      this.broadcastToRoom(noteId, {
        type: 'user_joined',
        user: { id: user.id, username: user.username },
        timestamp: new Date().toISOString()
      }, ws);

      // Handle messages
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // Handle disconnect
      ws.on('close', () => {
        this.leaveRoom(ws, noteId);
        
        // Clean up typing indicator
        this.handleTypingStop(ws, {});
        
        this.broadcastToRoom(noteId, {
          type: 'user_left',
          user: { id: user.id, username: user.username },
          timestamp: new Date().toISOString()
        });
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.leaveRoom(ws, noteId);
      });

    } catch (error) {
      console.error('Authentication error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'join_note':
          this.handleJoinNote(ws, message);
          break;
        case 'edit_note':
          this.handleEditNote(ws, message);
          break;
        case 'live_typing':
          this.handleLiveTyping(ws, message);
          break;
        case 'live_edit':
          this.handleLiveEdit(ws, message);
          break;
        case 'cursor_position':
          this.handleCursorPosition(ws, message);
          break;
        case 'typing_start':
          this.handleTypingStart(ws, message);
          break;
        case 'typing_stop':
          this.handleTypingStop(ws, message);
          break;
        case 'save_note':
          this.handleSaveNote(ws, message);
          break;
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type'
          }));
      }
    } catch (error) {
      console.error('Message handling error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  }

  handleJoinNote(ws, message) {
    // User is already joined, just acknowledge
    ws.send(JSON.stringify({
      type: 'joined',
      noteId: ws.noteId,
      timestamp: new Date().toISOString()
    }));
  }

  async handleEditNote(ws, message) {
    const { content, title } = message;
    
    try {
      // Check if user has edit permissions
      const { userRole } = await verifyNoteAccess(ws.noteId, ws.userId);
      
      if (userRole === 'viewer') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Viewer role cannot edit notes'
        }));
        return;
      }

      // Update note in database (last write wins)
      const updatedNote = await prisma.note.update({
        where: { id: ws.noteId },
        data: {
          ...(content !== undefined && { content }),
          ...(title !== undefined && { title })
        }
      });

      // Broadcast to all users in the room except sender
      this.broadcastToRoom(ws.noteId, {
        type: 'note_updated',
        content: updatedNote.content,
        title: updatedNote.title,
        updatedBy: { id: ws.userId, username: ws.username },
        timestamp: new Date().toISOString()
      }, ws);

    } catch (error) {
      console.error('Error updating note:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to update note'
      }));
    }
  }

  handleLiveTyping(ws, message) {
    const { content, title, cursorPosition } = message;
    
    // Broadcast live typing to other users (don't save to DB yet)
    this.broadcastToRoom(ws.noteId, {
      type: 'live_typing',
      content,
      title,
      cursorPosition,
      user: { id: ws.userId, username: ws.username },
      timestamp: new Date().toISOString()
    }, ws);

    // Set up auto-save timer (debounced)
    this.scheduleAutoSave(ws.noteId, { content, title });
  }

  handleLiveEdit(ws, message) {
    const { content, title } = message;
    
    // Broadcast live edit to other users (don't save to DB yet)
    this.broadcastToRoom(ws.noteId, {
      type: 'live_edit',
      content,
      title,
      user: { id: ws.userId, username: ws.username },
      timestamp: new Date().toISOString()
    }, ws);

    // Set up auto-save timer (debounced)
    this.scheduleAutoSave(ws.noteId, { content, title });
  }

  handleTypingStart(ws, message) {
    const noteId = ws.noteId;
    
    // Add user to typing list
    if (!this.typingUsers.has(noteId)) {
      this.typingUsers.set(noteId, new Map());
    }
    
    this.typingUsers.get(noteId).set(ws.userId, {
      username: ws.username,
      timestamp: Date.now()
    });

    // Broadcast typing indicator to other users
    this.broadcastToRoom(noteId, {
      type: 'typing_start',
      user: { id: ws.userId, username: ws.username },
      typingUsers: this.getTypingUsers(noteId),
      timestamp: new Date().toISOString()
    }, ws);
  }

  handleTypingStop(ws, message) {
    const noteId = ws.noteId;
    
    // Remove user from typing list
    if (this.typingUsers.has(noteId)) {
      this.typingUsers.get(noteId).delete(ws.userId);
      
      // Clean up empty typing map
      if (this.typingUsers.get(noteId).size === 0) {
        this.typingUsers.delete(noteId);
      }
    }

    // Broadcast typing stop to other users
    this.broadcastToRoom(noteId, {
      type: 'typing_stop',
      user: { id: ws.userId, username: ws.username },
      typingUsers: this.getTypingUsers(noteId),
      timestamp: new Date().toISOString()
    }, ws);
  }

  async handleSaveNote(ws, message) {
    const { content, title } = message;
    
    try {
      // Check if user has edit permissions
      const { userRole } = await verifyNoteAccess(ws.noteId, ws.userId);
      
      if (userRole === 'viewer') {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Viewer role cannot save notes'
        }));
        return;
      }

      // Clear any pending auto-save
      this.clearAutoSave(ws.noteId);

      // Update note in database
      const updatedNote = await prisma.note.update({
        where: { id: ws.noteId },
        data: {
          ...(content !== undefined && { content }),
          ...(title !== undefined && { title })
        }
      });

      // Broadcast save confirmation to all users
      this.broadcastToRoom(ws.noteId, {
        type: 'note_saved',
        content: updatedNote.content,
        title: updatedNote.title,
        savedBy: { id: ws.userId, username: ws.username },
        timestamp: new Date().toISOString()
      });

      // Send confirmation to the user who saved
      ws.send(JSON.stringify({
        type: 'save_success',
        message: 'Note saved successfully',
        timestamp: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Error saving note:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to save note'
      }));
    }
  }

  handleCursorPosition(ws, message) {
    const { position } = message;
    
    // Broadcast cursor position to other users
    this.broadcastToRoom(ws.noteId, {
      type: 'cursor_position',
      position,
      user: { id: ws.userId, username: ws.username },
      timestamp: new Date().toISOString()
    }, ws);
  }

  joinRoom(ws, noteId) {
    if (!this.rooms.has(noteId)) {
      this.rooms.set(noteId, new Set());
    }
    this.rooms.get(noteId).add(ws);
    console.log(`User ${ws.username} joined note ${noteId}`);
  }

  leaveRoom(ws, noteId) {
    if (this.rooms.has(noteId)) {
      this.rooms.get(noteId).delete(ws);
      if (this.rooms.get(noteId).size === 0) {
        this.rooms.delete(noteId);
      }
    }
    console.log(`User ${ws.username} left note ${noteId}`);
  }

  broadcastToRoom(noteId, message, excludeWs = null) {
    if (this.rooms.has(noteId)) {
      this.rooms.get(noteId).forEach(ws => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    }
  }

  getRoomInfo(noteId) {
    if (!this.rooms.has(noteId)) {
      return { users: [] };
    }

    const users = Array.from(this.rooms.get(noteId)).map(ws => ({
      id: ws.userId,
      username: ws.username
    }));

    return { users };
  }

  getTypingUsers(noteId) {
    if (!this.typingUsers.has(noteId)) {
      return [];
    }

    const now = Date.now();
    const typingMap = this.typingUsers.get(noteId);
    
    // Clean up old typing indicators (older than 5 seconds)
    for (const [userId, data] of typingMap.entries()) {
      if (now - data.timestamp > 5000) {
        typingMap.delete(userId);
      }
    }

    return Array.from(typingMap.values()).map(data => data.username);
  }

  scheduleAutoSave(noteId, data) {
    // Clear existing timer
    this.clearAutoSave(noteId);

    // Set new timer (auto-save after 2 seconds of inactivity)
    const timer = setTimeout(async () => {
      try {
        await prisma.note.update({
          where: { id: noteId },
          data: {
            ...(data.content !== undefined && { content: data.content }),
            ...(data.title !== undefined && { title: data.title })
          }
        });

        // Broadcast auto-save notification
        this.broadcastToRoom(noteId, {
          type: 'auto_saved',
          timestamp: new Date().toISOString()
        });

        console.log(`Auto-saved note ${noteId}`);
      } catch (error) {
        console.error('Auto-save error:', error);
      }
    }, 2000);

    this.autoSaveTimers.set(noteId, timer);
  }

  clearAutoSave(noteId) {
    if (this.autoSaveTimers.has(noteId)) {
      clearTimeout(this.autoSaveTimers.get(noteId));
      this.autoSaveTimers.delete(noteId);
    }
  }
}

module.exports = new WebSocketServer();
