const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/database');

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.rooms = new Map(); // Map<noteId, Set<WebSocket>>
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws/notes'
    });

    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection attempt');

      // Extract note ID from URL path
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/');
      const noteId = pathParts[pathParts.length - 1];

      if (!noteId) {
        ws.close(1008, 'Note ID required');
        return;
      }

      // Authenticate user
      this.authenticateUser(ws, req, noteId);
    });

    console.log(`WebSocket server running on port ${config.wsPort}`);
  }

  async authenticateUser(ws, req, noteId) {
    try {
      // Extract token from query params or headers
      const token = req.url.split('token=')[1]?.split('&')[0] || 
                   req.headers.authorization?.split(' ')[1];

      if (!token) {
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

      // Verify user has access to the note
      const note = await prisma.note.findFirst({
        where: {
          id: noteId,
          userId: user.id
        }
      });

      if (!note) {
        ws.close(1008, 'Access denied to note');
        return;
      }

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
        case 'cursor_position':
          this.handleCursorPosition(ws, message);
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
}

module.exports = new WebSocketServer();
