const { processPendingReminders } = require('../services/reminderService');
const logger = require('../utils/logger');

const startScheduler = () => {
  logger.info('Initializing durable reminder background worker...');
  setInterval(async () => {
    try {
      await processPendingReminders();
    } catch (error) {
      logger.error(`Scheduler error: ${error.message}`);
    }
  }, 60000);
};

module.exports = { startScheduler };