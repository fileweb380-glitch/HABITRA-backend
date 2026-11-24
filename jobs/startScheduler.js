const cron = require('node-cron');
const { processPendingReminders } = require('../services/reminderService');
const schedulerService = require('../services/schedulerService');

const startScheduler = () => {
  // 1. Run immediately on server startup so missed midnight runs still schedule today's habits
  schedulerService.generateDailyHabitJobs();

  // 2. Check queue every minute for pending reminders
  cron.schedule('* * * * *', async () => {
    try {
      await processPendingReminders();
    } catch (err) {
      console.error('Error in reminder processing cron:', err.message);
    }
  });

  // 3. Generate habit reminder jobs at midnight AND every hour as a safety net
  cron.schedule('0 * * * *', async () => {
    try {
      await schedulerService.generateDailyHabitJobs();
    } catch (err) {
      console.error('Error in daily habit generator cron:', err.message);
    }
  });
};

module.exports = { startScheduler };