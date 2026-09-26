// Importing modules
import transporter from '../config/mail.config.js';
import logger from '../config/logger.config.js';
import env from '../config/env.config.js';

// function to send the mails
function sendMail(to: string, subject: string, html: string) {
  if (env.SEND_MAIL) {
    transporter
      .sendMail({ from: env.SENDING_USER || 'noreply@example.com', to, subject, html })
      .catch((err) => logger.error({ err, to, subject }, 'Failed to send mail'));
  } else {
    // SEND_MAIL=false (local dev): print the mail so links like password resets stay usable
    logger.info(`[Mail disabled] To: ${to} | Subject: ${subject} | HTML: ${html}`);
  }
}

export default sendMail;
