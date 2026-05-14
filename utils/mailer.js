const nodemailer = require('nodemailer');

const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 465;
const secure = process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : true;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendMail = async ({ to, subject, text, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email credentials not configured in .env (EMAIL_USER/EMAIL_PASS)');
  }

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html
  });
  return info;
};

module.exports = { sendMail };
