const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error) => {
  if (error) {
    logger.error(`[Email Service] Gmail connection error: ${error.message}`);
  } else {
    logger.info('[Email Service] Gmail server is ready to send real emails!');
  }
});

const sendEmail = async ({ to, email, subject, text, message, html }) => {
  const recipient = to || email;
  const plainText = text || message || '';

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('[Email Service] EMAIL_USER or EMAIL_PASS missing in .env');
    return false;
  }

  if (!recipient) {
    logger.warn('[Email Service] Missing recipient email address');
    return false;
  }

  const finalHtml =
    html ||
    `<div style="font-family: Arial, sans-serif; padding: 20px; border-radius: 8px; background: #f9f9f9;">
      <h2 style="color: #4f46e5;">HABITRA Reminder</h2>
      <p style="font-size: 16px; color: #333;">${plainText}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">Stay consistent with your daily commitments.</p>
    </div>`;

  try {
    const info = await transporter.sendMail({
      from: `"HABITRA" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject,
      text: plainText,
      html: finalHtml
    });
    logger.info(`[Email Service] Real email delivered to ${recipient} (ID: ${info.messageId})`);
    return true;
  } catch (error) {
    logger.error(`[Email Service] Failed to send email to ${recipient}: ${error.message}`);
    return false;
  }
};

// Backward-compatible wrapper if called elsewhere as sendHabitEmail(to, subject, text)
const sendHabitEmail = async (to, subject, text, html) => {
  return sendEmail({ to, subject, text, html });
};

module.exports = { sendEmail, sendHabitEmail };