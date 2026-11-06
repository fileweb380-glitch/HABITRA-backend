const { processPendingReminders } = require('../services/reminderService');

const runProcessReminders = async () => {
  await processPendingReminders();
};

module.exports = { runProcessReminders };