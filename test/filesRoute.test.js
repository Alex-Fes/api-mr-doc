const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { createDatabase } = require('../src/storage/database');
const { createFilesRouter } = require('../src/routes/files');

const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, () => resolve(server));
});

test('GET /files/:token returns stored file bytes and headers', async () => {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-route-'));
  const database = createDatabase(path.join(storageDir, 'data.sqlite'));
  const relativePath = 'files/2026/04/submission-1/file-1.txt';
  const absolutePath = path.join(storageDir, relativePath);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, 'hello file');

  database.createSubmission({
    id: 'submission-1',
    name: '',
    phone: '9991112233',
    reviewText: '',
    service: 'Запись на прием',
    privacyConsent: true,
    ip: '127.0.0.1',
  });
  database.createSubmissionFile({
    id: 'file-1',
    submissionId: 'submission-1',
    token: 'known-token',
    originalName: 'review.txt',
    storedName: 'file-1.txt',
    mimeType: 'text/plain',
    sizeBytes: 10,
    relativePath,
  });

  const app = express();
  app.use('/files', createFilesRouter({ database, storageDir }));
  const server = await listen(app);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/files/known-token`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/plain');
    assert.match(response.headers.get('content-disposition'), /review\.txt/);
    assert.equal(await response.text(), 'hello file');
  } finally {
    server.close();
  }
});

test('GET /files/:token returns 404 for unknown token', async () => {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-route-'));
  const database = createDatabase(path.join(storageDir, 'data.sqlite'));
  const app = express();
  app.use('/files', createFilesRouter({ database, storageDir }));
  const server = await listen(app);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/files/missing-token`);

    assert.equal(response.status, 404);
  } finally {
    server.close();
  }
});
