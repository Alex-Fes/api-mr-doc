const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const addLine = (lines, label, value) => {
  if (value === undefined || value === null || value === '') return;
  lines.push(`${label}: ${value}`);
};

const formatFileLine = (file) => `${file.originalName}: ${file.url}`;

const renderField = (label, value) => {
  if (value === undefined || value === null || value === '') return '';

  return `
    <div style="padding: 12px 0; border-bottom: 1px solid #e8edf3;">
      <div style="margin: 0 0 4px; font-size: 12px; line-height: 1.4; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em;">${escapeHtml(label)}</div>
      <div style="font-size: 16px; line-height: 1.5; color: #152033; white-space: pre-wrap;">${escapeHtml(value)}</div>
    </div>
  `;
};

const renderSection = (title, content) => {
  if (!content.trim()) return '';

  return `
    <section style="margin: 0 0 24px;">
      <h3 style="margin: 0 0 8px; font-size: 16px; line-height: 1.35; color: #0f5e8c;">${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
};

const formatSubmissionEmail = (submission) => {
  const service = submission.service || 'Форма сайта';
  const submittedAt = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
  });

  const lines = [];
  addLine(lines, 'Источник', service);
  addLine(lines, 'Имя', submission.name);
  addLine(lines, 'Телефон', submission.phone);
  addLine(lines, 'Сообщение', submission.reviewText);
  addLine(lines, 'Дата отправки', submittedAt);

  const fileLines = Array.isArray(submission.files) && submission.files.length > 0
    ? submission.files.map(formatFileLine)
    : [];

  if (fileLines.length > 0) {
    lines.push('');
    lines.push('Файлы:');
    fileLines.forEach((line) => lines.push(`- ${line}`));
  }

  const contactSection = renderSection('Контакт', [
    renderField('Имя', submission.name),
    renderField('Телефон', submission.phone),
  ].join(''));

  const requestSection = renderSection('Заявка', [
    renderField('Источник', service),
    renderField('Сообщение', submission.reviewText),
    renderField('Дата отправки', submittedAt),
  ].join(''));

  const htmlFiles = fileLines.length > 0
    ? `
        <section style="margin: 0;">
          <h3 style="margin: 0 0 12px; font-size: 16px; line-height: 1.35; color: #0f5e8c;">Файлы</h3>
          ${submission.files.map((file) => `
            <a href="${escapeHtml(file.url)}" style="display: block; margin: 0 0 8px; padding: 12px 14px; border: 1px solid #cfe0ed; border-radius: 8px; background: #f7fbff; color: #0f5e8c; font-size: 15px; line-height: 1.4; text-decoration: none;">${escapeHtml(file.originalName)}</a>
          `).join('')}
        </section>
      `
    : '';

  return {
    subject: `Новая заявка: ${service}`,
    text: lines.join('\n'),
    html: `
      <div style="margin: 0; padding: 32px 16px; background-color: #f3f7fb; font-family: Arial, sans-serif; color: #152033;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid #dbe6ef; border-radius: 12px; background: #ffffff; overflow: hidden;">
          <div style="padding: 24px 28px; background: #0f5e8c; color: #ffffff;">
            <div style="margin: 0 0 6px; font-size: 13px; line-height: 1.4; opacity: 0.86;">Mr. Doc</div>
            <h2 style="margin: 0; font-size: 24px; line-height: 1.25; font-weight: 700;">Новая заявка с сайта</h2>
          </div>
          <div style="padding: 24px 28px 28px;">
            ${contactSection}
            ${requestSection}
            ${htmlFiles}
          </div>
        </div>
      </div>
    `,
  };
};

module.exports = {
  formatSubmissionEmail,
};
