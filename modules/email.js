'use strict';

const axios = require('axios');

async function sendEmail({ to, subject, text, from }) {
  const sender = from || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!sender) {
    throw new Error('Sender email is required');
  }
  const apiKey = process.env.BREVO_API_KEY;
  const endpointUrl = process.env.BREVO_API_ENDPOINT_URL;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is required');
  }
  if (!endpointUrl) {
    throw new Error('BREVO_API_ENDPOINT_URL is required');
  }
  return sendViaBrevo({ to, subject, text, from: sender, apiKey, endpointUrl });
}

async function sendViaBrevo({ to, from, subject, text, apiKey, endpointUrl }) {
  const payload = {
    sender: { email: from },
    to: Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }],
    subject,
    textContent: text,
  };
  await axios.post(endpointUrl, payload, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
}

module.exports = { sendEmail };
