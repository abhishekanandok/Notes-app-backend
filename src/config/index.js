require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  wsPort: process.env.WS_PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
};
