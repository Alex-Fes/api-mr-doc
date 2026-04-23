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

const toAttachment = (file) => ({
  filename: file.originalname,
  content: file.buffer,
  contentType: file.mimetype,
});

const sendSubmissionEmail = async (submission, files = []) => {
  const email = formatSubmissionEmail(submission);

  return transporter.sendMail({
    from: config.mail.from,
    to: config.mail.to,
    replyTo: config.mail.from,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: files.map(toAttachment),
  });
};

module.exports = {
  sendSubmissionEmail,
};
