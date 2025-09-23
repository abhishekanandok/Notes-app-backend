# Notes App Backend

A real-time collaborative notes application backend built with Node.js, Express, PostgreSQL, Prisma, and WebSockets.

## Features

- 🔐 JWT-based authentication with bcrypt password hashing
- 📝 CRUD operations for Notes and Folders
- 🔄 Real-time collaboration using WebSockets
- 🛡️ Protected API routes with JWT middleware
- 📊 PostgreSQL database with Prisma ORM
- 🚨 Centralized error handling and logging
- 🏗️ Clean modular architecture

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (NeonDB)
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Real-time**: WebSockets (ws library)
- **Security**: Helmet, CORS

## Project Structure

```
src/
├── config/           # Configuration files
├── middleware/       # Express middleware
├── routes/          # API routes
├── controllers/     # Route controllers
├── services/        # Business logic
├── db/             # Database related
├── ws/             # WebSocket server
├── app.js          # Express app setup
└── index.js        # Server entry point
```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment setup**:
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/notes_app?schema=public"
   
   # JWT
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   JWT_EXPIRES_IN="7d"
   
   # Server
   PORT=3000
   NODE_ENV="development"
   
   # WebSocket
   WS_PORT=8080
   ```

3. **Database setup**:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Notes
- `GET /api/notes` - Get all user notes (protected)
- `GET /api/notes/:id` - Get single note (protected)
- `POST /api/notes` - Create new note (protected)
- `PUT /api/notes/:id` - Update note (protected)
- `DELETE /api/notes/:id` - Delete note (protected)

### Folders
- `GET /api/folders` - Get all user folders (protected)
- `GET /api/folders/:id` - Get single folder (protected)
- `POST /api/folders` - Create new folder (protected)
- `PUT /api/folders/:id` - Update folder (protected)
- `DELETE /api/folders/:id` - Delete folder (protected)

## WebSocket API

Connect to: `ws://localhost:8080/ws/notes/:noteId?token=JWT_TOKEN`

### Events

#### Client → Server
- `join_note` - Join a note editing session
- `edit_note` - Send content updates
- `cursor_position` - Send cursor position

#### Server → Client
- `connected` - Connection established
- `joined` - Successfully joined note
- `note_updated` - Note content updated
- `user_joined` - User joined the session
- `user_left` - User left the session
- `cursor_position` - Another user's cursor position
- `error` - Error message

### Example WebSocket Usage

```javascript
const ws = new WebSocket('ws://localhost:8080/ws/notes/note-id?token=your-jwt-token');

ws.onopen = () => {
  // Join the note
  ws.send(JSON.stringify({
    type: 'join_note'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Send content update
ws.send(JSON.stringify({
  type: 'edit_note',
  content: 'Updated note content',
  title: 'Updated title'
}));
```

## Database Schema

### User
- `id` (String, Primary Key)
- `email` (String, Unique)
- `username` (String, Unique)
- `password` (String, Hashed)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Folder
- `id` (String, Primary Key)
- `name` (String)
- `description` (String, Optional)
- `userId` (String, Foreign Key)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

### Note
- `id` (String, Primary Key)
- `title` (String)
- `content` (String)
- `userId` (String, Foreign Key)
- `folderId` (String, Foreign Key, Optional)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)

## Development

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Protected API routes
- CORS configuration
- Helmet security headers
- Input validation and sanitization
- SQL injection protection via Prisma

## Error Handling

- Centralized error handling middleware
- Proper HTTP status codes
- Detailed error messages in development
- Secure error messages in production
- Request logging with Morgan
