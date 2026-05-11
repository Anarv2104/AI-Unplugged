function splitEmails(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function createBrevoProvider({ apiKey, senderEmail, senderName }) {
  function validateMailConfig() {
    if (!apiKey) {
      throw new Error('Brevo API key is missing. Set BREVO_API_KEY in backend/.env.');
    }

    if (!senderEmail) {
      throw new Error('Brevo sender email is missing. Set BREVO_SENDER_EMAIL in backend/.env.');
    }

    return {
      apiKey,
      senderEmail,
      senderName: senderName || 'AI Unplugged'
    };
  }

  async function sendCampaignEmail({ recipients, subject, html, text }) {
    const config = validateMailConfig();

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        sender: { email: config.senderEmail, name: config.senderName },
        to: [{ email: config.senderEmail, name: config.senderName }],
        bcc: recipients.map((email) => ({ email })),
        subject,
        htmlContent: html,
        textContent: text || null
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Brevo send failed: ${body}`);
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
