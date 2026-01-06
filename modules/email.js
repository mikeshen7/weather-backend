'use strict';

const nodemailer = require('nodemailer');
const axios = require('axios');

function getBrevoKey() {
  return process.env.BREVO_API_KEY;
}

async function sendEmail({ to, subject, text, from }) {
  const sender = from || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!sender) {
    throw new Error('Sender email is required');
  }
  const brevoKey = getBrevoKey();
  if (brevoKey) {
    return sendViaBrevo({ to, subject, text, from: sender, apiKey: brevoKey });
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from: sender,
    to,
    subject,
    text,
  });
}

async function sendViaBrevo({ to, from, subject, text, apiKey }) {
  const payload = {
    sender: { email: from },
    to: Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }],
    subject,
    textContent: text,
  };
  await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

let cachedTransporter;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP configuration is missing');
  }
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

module.exports = { sendEmail };
