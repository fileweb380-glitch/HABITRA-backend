const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const recipient = options.email || options.to;
  const textContent = options.message || options.text;
  const fromAddress =
    process.env.FROM_EMAIL ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    'onboarding@resend.dev';

  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `HABITRA <${fromAddress}>`,
        to: [recipient],
        subject: options.subject,
        text: textContent,
        html: options.html
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Resend API error (${response.status}): ${errText}`);
    }

    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: process.env.SMTP_USER || process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  await transporter.sendMail({
    from: `"HABITRA" <${fromAddress}>`,
    to: recipient,
    subject: options.subject,
    text: textContent,
    html: options.html
  });
};

module.exports = sendEmail;
