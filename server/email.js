import { Resend } from 'resend';

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtml(value) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export async function sendEmail({ recipientEmail, replyTo, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      providerMessageId: null,
      error: 'Email provider is not configured',
    };
  }

  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) {
    return {
      success: false,
      providerMessageId: null,
      error: 'Email sender is not configured',
    };
  }

  try {
    const resend = new Resend(apiKey);
    const bodyText = text?.trim() || stripHtml(html);
    const bodyHtml = html?.trim() || textToHtml(bodyText);
    const { data, error } = await resend.emails.send({
      from: `Research Platform <${fromAddress}>`,
      to: recipientEmail,
      replyTo,
      subject,
      html: bodyHtml,
      text: bodyText,
    });

    if (error) {
      return {
        success: false,
        providerMessageId: null,
        error: error.message || 'Resend email delivery failed.',
      };
    }

    return {
      success: true,
      providerMessageId: data?.id ?? null,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      providerMessageId: null,
      error: error instanceof Error ? error.message : 'Resend email delivery failed.',
    };
  }
}
