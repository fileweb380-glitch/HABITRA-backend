require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/database');
const logger = require('./utils/logger');

// Import your schedulers
const initNotificationScheduler = require('./utils/notificationScheduler');
const { startHabitScheduler } = require('./jobs/habitScheduler');

const PORT = process.env.PORT || 5000;

connectDatabase().then(() => {
  app.listen(PORT, () => {
    logger.info(`HABITRA server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    
    // Start notification schedulers
    initNotificationScheduler(); // Handles Commitments
    startHabitScheduler();       // Handles Daily, Weekly, Monthly, and Yearly Habits
  });
});