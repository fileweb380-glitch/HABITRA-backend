const logger = require('../utils/logger');

const sendEmail = async ({ to, subject, text }) => {
  // Production email provider integration stub (e.g. SendGrid / Mailgun / SMTP)
  logger.info(`[Email Service] Sending email to ${to} | Subject: ${subject}`);
  return true;
};

module.exports = { sendEmail };