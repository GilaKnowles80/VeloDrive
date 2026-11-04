const nodemailer = require('nodemailer');

let twilioClient = null;
try {
  const twilio = require('twilio');
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (e) {
  // twilio package not installed - communications will be mocked
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SENDGRID_API_KEY || process.env.SMTP_PASS
  }
});

/**
 * Send email
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"VeloDrive" <${process.env.FROM_EMAIL || 'noreply@veodrive.com'}>`,
      to,
      subject,
      text,
      html
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send SMS
 */
const sendSMS = async ({ to, body }) => {
  try {
    if (twilioClient) {
      const message = await twilioClient.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      return { success: true, messageId: message.sid };
    }
    // Mock for development
    console.log(`[MOCK SMS] To: ${to} | ${body}`);
    return { success: true, messageId: 'mock-sms-' + Date.now() };
  } catch (error) {
    console.error('SMS error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Make voice call (Twilio TwiML)
 */
const sendVoiceCall = async ({ to, message }) => {
  try {
    if (twilioClient) {
      const call = await twilioClient.calls.create({
        twiml: `<Response><Say>${message}</Say></Response>`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      return { success: true, callSid: call.sid };
    }
    // Mock for development
    console.log(`[MOCK VOICE CALL] To: ${to} | ${message}`);
    return { success: true, callSid: 'mock-call-' + Date.now() };
  } catch (error) {
    console.error('Voice call error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Notify via all channels: phone call, SMS, email
 */
const notifyAllChannels = async ({ user, subject, message, bookingReference }) => {
  const results = { email: null, sms: null, voiceCall: null };

  if (user.email) {
    results.email = await sendEmail({
      to: user.email,
      subject,
      text: message,
      html: `<p>${message}</p><p>Booking: ${bookingReference || ''}</p>`
    });
  }
  if (user.phone) {
    results.sms = await sendSMS({
      to: user.phone,
      body: `${subject}\n${message}\nBooking: ${bookingReference || ''}`
    });
    results.voiceCall = await sendVoiceCall({
      to: user.phone,
      message: `${subject}. ${message}`
    });
  }

  return results;
};

module.exports = { sendEmail, sendSMS, sendVoiceCall, notifyAllChannels };