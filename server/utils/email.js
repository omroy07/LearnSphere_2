const nodemailer = require("nodemailer");
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASSWORD,
  SMTP_FROM,
  APP_BASE_URL,
} = require("../config");

function buildAppUrl(path) {
  return `${APP_BASE_URL}${path}`;
}

async function sendEmail(toEmail, subject, body) {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    console.log(`[AUTH] Email not sent (SMTP not configured). To: ${toEmail}`);
    console.log(`[AUTH] Subject: ${subject}`);
    console.log(`[AUTH] Body:\n${body}`);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to: toEmail,
      subject,
      text: body,
    });

    return { sent: true };
  } catch (error) {
    console.error(`[AUTH] Email failed for ${toEmail}:`, error.message);
    return { sent: false, reason: "failed" };
  }
}

module.exports = {
  buildAppUrl,
  sendEmail,
};
