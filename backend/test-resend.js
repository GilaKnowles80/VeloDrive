'use strict';

require('dotenv').config();
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.FROM_EMAIL || process.env.EMAIL_FROM;
const to = process.env.RESEND_TEST_TO;

if (!apiKey || !from || !to) {
  console.error('Set RESEND_API_KEY, FROM_EMAIL, and RESEND_TEST_TO in the backend environment.');
  process.exitCode = 1;
} else {
  const resend = new Resend(apiKey);

  resend.emails.send({
    from,
    to: [to],
    subject: 'VeloDrive Resend test',
    text: 'This is a test email from the VeloDrive backend.',
  })
    .then(({ data, error }) => {
      if (error) {
        console.error('Resend test failed:', error.message);
        process.exitCode = 1;
        return;
      }

      console.log('Resend accepted the test email. Message ID:', data.id);
    })
    .catch((error) => {
      console.error('Resend test failed:', error.message);
      process.exitCode = 1;
    });
}
