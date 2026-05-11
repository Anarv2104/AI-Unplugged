const { HttpsError } = require('firebase-functions/v2/https');

function splitEmails(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function createBrevoProvider({ apiKeySecret, senderEmailSecret, senderNameSecret }) {
  function validateMailConfig() {
    const apiKey = apiKeySecret.value();
    const senderEmail = senderEmailSecret.value();

    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Brevo API key is missing. Set BREVO_API_KEY in backend function secrets.');
    }

    if (!senderEmail) {
      throw new HttpsError('failed-precondition', 'Brevo sender email is missing. Set BREVO_SENDER_EMAIL in backend function secrets.');
    }

    return {
      apiKey,
      senderEmail,
      senderName: senderNameSecret.value() || 'AI Unplugged'
    };
  }

  async function sendCampaignEmail({ recipients, subject, html, text }) {
    const { apiKey, senderEmail, senderName } = validateMailConfig();

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: senderEmail, name: senderName }],
        bcc: recipients.map((email) => ({ email })),
        subject,
        htmlContent: html,
        textContent: text || null
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new HttpsError('internal', `Brevo send failed: ${body}`);
    }

    return { ok: true, sent: recipients.length };
  }

  async function sendTransactionalEmail({ to, subject, html, text }) {
    const recipients = Array.isArray(to) ? to : [to];
    return sendCampaignEmail({ recipients, subject, html, text });
  }

  return {
    providerName: 'brevo',
    validateMailConfig,
    sendCampaignEmail,
    sendTransactionalEmail
  };
}

module.exports = {
  createBrevoProvider,
  splitEmails
};
