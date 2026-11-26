
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const recipient = options.email || options.to;
  const textContent = options.message || options.text;

  if (!recipient) {
    throw new Error('Email recipient is required.');
  }

  const emailUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const emailPassword = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!emailUser || !emailPassword) {
    throw new Error(
      'SMTP configuration is missing. Set SMTP_USER and SMTP_PASS.'
    );
  }

  const port = Number(process.env.SMTP_PORT) || 587;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: emailUser,
      pass: emailPassword
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });

  const mailOptions = {
    from: `"HABITRA" <${process.env.FROM_EMAIL || emailUser}>`,
    to: recipient,
    subject: options.subject || 'HABITRA Notification',
    text: textContent,
    html: options.html
  };

  const result = await transporter.sendMail(mailOptions);

  console.log('Email successfully sent:', result.messageId);

  return result;
};

module.exports = sendEmail;
