const logger = require('../utils/logger');

const schedulerService = {
  scheduleJob: async (jobData) => {
    logger.info(`Scheduling reminder job for commitment ${jobData.commitment}`);
  }
};

module.exports = schedulerService;