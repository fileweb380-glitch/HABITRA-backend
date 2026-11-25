const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const recipient = options.email || options.to;
  const textContent = options.message || options.text;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `"HABITRA" <${process.env.FROM_EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER}>`,
    to: recipient,
    subject: options.subject,
    text: textContent,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
