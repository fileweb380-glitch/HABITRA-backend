
require('dotenv').config();

const app = require('./app');
const connectDatabase = require('./config/database');
const logger = require('./utils/logger');

const { startReminderEngine } = require('./utils/reminderEngine');

const PORT = process.env.PORT || 5000;

connectDatabase().then(() => {
  app.listen(PORT, () => {
    logger.info(
      `HABITRA server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
    );

    startReminderEngine();
  });
}).catch((error) => {
  logger.error(`Database connection failed: ${error.message}`);
  process.exit(1);
});
