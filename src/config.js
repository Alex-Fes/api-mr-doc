require('dotenv').config();

const requiredEnvVars = [
  'FRONTEND_URL',
  'API_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'MAIL_TO',
];

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const toInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const config = {
  port: toInteger(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL,
  apiUrl: process.env.API_URL,
  smtp: {
    host: process.env.SMTP_HOST,
    port: toInteger(process.env.SMTP_PORT, 465),
    secure: toBoolean(process.env.SMTP_SECURE, true),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  mail: {
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_TO,
  },
  upload: {
    maxFileSizeBytes: toInteger(process.env.MAX_FILE_SIZE_MB, 15) * 1024 * 1024,
    maxFiles: toInteger(process.env.MAX_FILES, 5),
  },
  storage: {
    dir: process.env.STORAGE_DIR || 'storage',
  },
};

module.exports = config;
