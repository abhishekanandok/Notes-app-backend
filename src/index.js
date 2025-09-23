const http = require('http');
const config = require('./config');
const app = require('./app');
const websocketServer = require('./ws/websocketServer');

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
websocketServer.initialize(server);

// Start server
const PORT = config.port;
const WS_PORT = config.wsPort;

server.listen(PORT, () => {
  console.log(`🚀 Server running in ${config.nodeEnv} mode on port ${PORT}`);
  console.log(`🔌 WebSocket server running on port ${WS_PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 WebSocket endpoint: ws://localhost:${WS_PORT}/ws/notes/:noteId?token=JWT_TOKEN`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});

module.exports = server;
