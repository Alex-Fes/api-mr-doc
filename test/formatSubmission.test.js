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

test('formatSubmissionEmail renders a clean admin-focused layout', () => {
  const email = formatSubmissionEmail({
    service: 'Консультация',
    name: 'Анна',
    phone: '9991112233',
    reviewText: 'Болит зуб',
    privacyConsent: true,
    ip: '127.0.0.1',
    files: [],
  });

  assert.match(email.text, /Дата отправки:/);
  assert.doesNotMatch(email.text, /Согласие на обработку ПД/);
  assert.doesNotMatch(email.text, /IP:/);

  assert.match(email.html, /Контакт/);
  assert.match(email.html, /Заявка/);
  assert.match(email.html, /background-color: #f3f7fb/);
  assert.doesNotMatch(email.html, /Согласие на обработку ПД/);
  assert.doesNotMatch(email.html, /127\.0\.0\.1/);
});
