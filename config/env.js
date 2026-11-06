require('dotenv').config();

const requiredEnv = ['PORT', 'MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL'];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[Warning] Environment variable ${key} is not set.`);
  }
});

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};