const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const sendEmailRouter = require('./routes/sendEmail');

const app = express();

const corsOptions = {
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
};

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много заявок. Попробуйте позже.',
  },
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', sendEmailRouter);

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

app.listen(config.port, () => {
  console.log(`Mail server is running on port ${config.port}`);
});
