const morgan = require('morgan');
const config = require('../config');

// Custom token for request ID
morgan.token('id', (req) => req.id);

// Custom format
const format = config.nodeEnv === 'production' 
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
  : ':method :url :status :response-time ms - :res[content-length]';

const logger = morgan(format);

module.exports = logger;
