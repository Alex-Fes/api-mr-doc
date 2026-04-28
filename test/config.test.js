const test = require('node:test');
const assert = require('node:assert/strict');

test('config exposes storage directory from STORAGE_DIR', () => {
  process.env.FRONTEND_URL = 'https://example.com';
  process.env.API_URL = 'https://api.example.com';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_USER = 'mailer@example.com';
  process.env.SMTP_PASS = 'secret';
  process.env.MAIL_FROM = 'mailer@example.com';
  process.env.MAIL_TO = 'clinic@example.com';
  process.env.STORAGE_DIR = 'custom-storage';

  delete require.cache[require.resolve('../src/config')];
  const config = require('../src/config');

  assert.equal(config.storage.dir, 'custom-storage');
});
