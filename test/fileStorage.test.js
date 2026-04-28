const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const {
  saveUploadedFiles,
  resolveStoredFilePath,
} = require('../src/storage/fileStorage');

test('saveUploadedFiles writes buffers and returns link metadata', async () => {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-files-'));
  const files = [{
    originalname: 'review.mp4',
    mimetype: 'video/mp4',
    size: 4,
    buffer: Buffer.from('test'),
  }];

  const saved = await saveUploadedFiles({
    storageDir,
    submissionId: 'submission-1',
    files,
    now: new Date('2026-04-28T10:00:00Z'),
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].originalName, 'review.mp4');
  assert.match(saved[0].token, /^[a-f0-9]{64}$/);
  assert.ok(fs.existsSync(path.join(storageDir, saved[0].relativePath)));
});

test('resolveStoredFilePath rejects traversal outside storage directory', () => {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-files-'));
  assert.throws(() => resolveStoredFilePath(storageDir, '../secret.txt'), /Invalid file path/);
});
