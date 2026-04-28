const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const createCorsOptions = (config) => ({
  origin(origin, callback) {
    if (!origin || origin === config.frontendUrl) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS_NOT_ALLOWED'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
});

const createSubmissionLimiter = (rateLimitOptions = {}) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много заявок. Попробуйте позже.',
  },
  ...rateLimitOptions,
});

const createApp = (options = {}) => {
  const config = options.config || require('./config');
  const sendEmailRouter = options.sendEmailRouter || require('./routes/sendEmail');
  const filesRouter = options.filesRouter || require('./routes/files');
  const corsOptions = createCorsOptions(config);

  const app = express();

  app.set('trust proxy', 1);
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', createSubmissionLimiter(options.rateLimitOptions), sendEmailRouter);
  app.use('/files', filesRouter);

  app.use((err, req, res, next) => {
    if (err && err.message === 'CORS_NOT_ALLOWED') {
      res.status(403).json({
        success: false,
        error: 'Origin not allowed',
      });
      return;
    }

    console.error('Unhandled server error:', err);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    });
  });

  return app;
};

module.exports = {
  createApp,
};
