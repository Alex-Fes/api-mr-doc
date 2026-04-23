const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const sendEmailRouter = require('./routes/sendEmail');

const app = express();

const corsOptions = config.corsOrigin === '*'
  ? { origin: true }
  : { origin: config.corsOrigin };

app.set('trust proxy', 1);
app.use(cors(corsOptions));
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
  res.json({ success: true, status: 'ok' });
});

app.use('/api', sendEmailRouter);

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера',
  });
});

app.listen(config.port, () => {
  console.log(`Mail server is running on port ${config.port}`);
});
