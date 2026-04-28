const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { createDatabase } = require('../src/storage/database');
const { processSubmission } = require('../src/submissions/processSubmission');

test('submission storage persists files and emails generated file links', async () => {
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-submission-'));
  const database = createDatabase(path.join(storageDir, 'data.sqlite'));
  let emailedSubmission;

  await processSubmission({
    submission: {
      name: 'Anna',
      phone: '9991112233',
      reviewText: '',
      service: 'Запись на прием',
      privacyConsent: true,
      ip: '127.0.0.1',
    },
    files: [{
      originalname: 'review.mp4',
      mimetype: 'video/mp4',
      size: 4,
      buffer: Buffer.from('test'),
    }],
    config: {
      apiUrl: 'https://api.mr-doc.ru',
      storage: { dir: storageDir },
    },
    database,
    sendSubmissionEmail: async (submission) => {
      emailedSubmission = submission;
    },
    createSubmissionId: () => 'submission-1',
    now: new Date('2026-04-28T10:00:00Z'),
  });

  assert.equal(emailedSubmission.id, 'submission-1');
  assert.equal(emailedSubmission.files.length, 1);
  assert.match(emailedSubmission.files[0].url, /^https:\/\/api\.mr-doc\.ru\/files\/[a-f0-9]{64}$/);

  const token = emailedSubmission.files[0].url.split('/').at(-1);
  const storedFile = database.findFileByToken(token);

  assert.equal(storedFile.originalName, 'review.mp4');
  assert.ok(fs.existsSync(path.join(storageDir, storedFile.relativePath)));
});
