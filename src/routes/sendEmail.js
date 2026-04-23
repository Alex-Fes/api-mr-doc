const express = require('express');
const multer = require('multer');
const config = require('../config');
const { sendSubmissionEmail } = require('../email/sendMail');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
    files: config.upload.maxFiles,
  },
});

const parseMultipartIfNeeded = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    next();
    return;
  }

  upload.array('files', config.upload.maxFiles)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      res.status(400).json({
        success: false,
        error: error.code === 'LIMIT_FILE_SIZE'
          ? 'Файл слишком большой'
          : 'Ошибка загрузки файла',
      });
      return;
    }

    next(error);
  });
};

const normalizeConsent = (value) => value === true || String(value).toLowerCase() === 'true';

const normalizeSubmission = (body, ip) => ({
  name: typeof body.name === 'string' ? body.name.trim() : '',
  phone: typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '',
  reviewText: typeof body.reviewText === 'string' ? body.reviewText.trim() : '',
  service: typeof body.service === 'string' ? body.service.trim() : '',
  privacyConsent: normalizeConsent(body.privacyConsent),
  ip,
});

const validateSubmission = (submission) => {
  if (!submission.service) {
    return 'Не указан источник заявки';
  }

  if (!submission.privacyConsent) {
    return 'Не подтверждено согласие на обработку персональных данных';
  }

  if (!submission.phone && !submission.reviewText) {
    return 'Укажите телефон или текст сообщения';
  }

  if (submission.phone && submission.phone.length !== 10) {
    return 'Некорректный номер телефона';
  }

  return null;
};

router.post('/send-email', parseMultipartIfNeeded, async (req, res) => {
  const submission = normalizeSubmission(req.body || {}, req.ip);
  const validationError = validateSubmission(submission);

  if (validationError) {
    res.status(400).json({
      success: false,
      error: validationError,
    });
    return;
  }

  try {
    await sendSubmissionEmail(submission, req.files || []);
    res.json({ success: true });
  } catch (error) {
    console.error('Email send failed:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось отправить заявку',
    });
  }
});

module.exports = router;
