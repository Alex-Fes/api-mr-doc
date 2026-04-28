const nodemailer = require('nodemailer');
const config = require('../config');
const { formatSubmissionEmail } = require('../utils/formatSubmission');

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

const sendSubmissionEmail = async (submission) => {
  const email = formatSubmissionEmail(submission);

  return transporter.sendMail({
    from: config.mail.from,
    to: config.mail.to,
    replyTo: config.mail.from,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
};

module.exports = {
  sendSubmissionEmail,
};
