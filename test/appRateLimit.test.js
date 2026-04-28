const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createApp } = require('../src/app');

const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, () => resolve(server));
});

test('submission rate limit does not apply to file downloads', async () => {
  const sendEmailRouter = express.Router();
  sendEmailRouter.post('/send-email', (req, res) => res.json({ success: true }));

  const filesRouter = express.Router();
  filesRouter.get('/:token', (req, res) => res.send('file'));

  const app = createApp({
    config: {
      frontendUrl: 'http://localhost:3000',
    },
    sendEmailRouter,
    filesRouter,
    rateLimitOptions: {
      windowMs: 60 * 1000,
      max: 1,
    },
  });
  const server = await listen(app);

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    assert.equal((await fetch(`${baseUrl}/api/send-email`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/send-email`, { method: 'POST' })).status, 429);
    assert.equal((await fetch(`${baseUrl}/files/known-token`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/files/known-token`)).status, 200);
  } finally {
    server.close();
  }
});
