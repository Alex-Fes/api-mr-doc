const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { createDatabase } = require('../src/storage/database');

test('database stores submissions and resolves files by token', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-db-'));
  const db = createDatabase(path.join(dir, 'data.sqlite'));

  const submission = db.createSubmission({
    id: 'submission-1',
    name: 'Anna',
    phone: '9991112233',
    reviewText: 'Video review',
    service: 'Форма сайта',
    privacyConsent: true,
    ip: '127.0.0.1',
  });

  db.createSubmissionFile({
    id: 'file-1',
    submissionId: submission.id,
    token: 'token-1',
    originalName: 'review.mp4',
    storedName: 'file-1.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 12,
    relativePath: 'files/2026/04/submission-1/file-1.mp4',
  });

  assert.equal(db.findFileByToken('token-1').originalName, 'review.mp4');
  assert.equal(db.findFileByToken('missing'), null);
});
