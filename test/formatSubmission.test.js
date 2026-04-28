const test = require('node:test');
const assert = require('node:assert/strict');
const { formatSubmissionEmail } = require('../src/utils/formatSubmission');

test('formatSubmissionEmail includes uploaded file links', () => {
  const email = formatSubmissionEmail({
    service: 'Запись на прием',
    phone: '9991112233',
    privacyConsent: true,
    files: [{
      originalName: 'review.mp4',
      url: 'https://api.mr-doc.ru/files/token',
    }],
  });

  assert.match(email.text, /Файлы:/);
  assert.match(email.text, /review\.mp4: https:\/\/api\.mr-doc\.ru\/files\/token/);
  assert.match(email.html, /review\.mp4/);
  assert.match(email.html, /https:\/\/api\.mr-doc\.ru\/files\/token/);
});
