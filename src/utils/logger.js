const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'health-automator' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const recentLogs = [];
const MAX_RECENT_LOGS = 100;

const originalLog = logger.log;
logger.log = function(level, message, meta) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta
  };
  
  recentLogs.push(logEntry);
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.shift();
  }
  
  return originalLog.call(this, level, message, meta);
};

logger.getRecentLogs = () => recentLogs;

module.exports = logger;