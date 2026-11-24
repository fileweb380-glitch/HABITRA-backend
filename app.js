const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const corsOptions = require('./config/cors');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const initNotificationScheduler = require('./utils/notificationScheduler');
const { startHabitScheduler } = require('./jobs/habitScheduler'); // Added clean habit scheduler

const authRoutes = require('./routes/authRoutes');
const goalRoutes = require('./routes/goalRoutes');
const commitmentRoutes = require('./routes/commitmentRoutes');
const habitRoutes = require('./routes/habitRoutes');
const checkinRoutes = require('./routes/checkinRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const pushRoutes = require('./routes/pushRoutes'); // Added push routes

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// Initialize Background Notification Cron Job Schedulers
initNotificationScheduler(); // Handles Commitments
startHabitScheduler();       // Handles Daily, Weekly, Monthly, and Yearly Habits

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/commitments', commitmentRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/push', pushRoutes); // Mounted push routes

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;