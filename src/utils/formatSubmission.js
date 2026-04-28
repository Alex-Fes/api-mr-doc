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
  addLine(lines, 'Согласие на обработку ПД', submission.privacyConsent ? 'Да' : 'Нет');
  addLine(lines, 'IP', submission.ip);
  addLine(lines, 'Дата отправки', submittedAt);

  const fileLines = Array.isArray(submission.files) && submission.files.length > 0
    ? submission.files.map(formatFileLine)
    : [];

  if (fileLines.length > 0) {
    lines.push('');
    lines.push('Файлы:');
    fileLines.forEach((line) => lines.push(`- ${line}`));
  }

  const detailLines = lines.filter((line) => line && !line.startsWith('- ') && line !== 'Файлы:');
  const htmlRows = detailLines.map((line) => {
    const separatorIndex = line.indexOf(':');
    const label = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1).trim();

    return `
      <tr>
        <td style="padding: 8px 12px; font-weight: 700; border-bottom: 1px solid #e5e7eb;">${escapeHtml(label)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(value)}</td>
      </tr>
    `;
  }).join('');

  const htmlFiles = fileLines.length > 0
    ? `
        <h3 style="margin: 20px 0 8px;">Файлы</h3>
        <ul style="padding-left: 20px; margin: 0;">
          ${submission.files.map((file) => `
            <li style="margin: 0 0 6px;">
              <a href="${escapeHtml(file.url)}">${escapeHtml(file.originalName)}</a>
            </li>
          `).join('')}
        </ul>
      `
    : '';

  return {
    subject: `Новая заявка: ${service}`,
    text: lines.join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827;">
        <h2 style="margin: 0 0 16px;">Новая заявка с сайта</h2>
        <table style="border-collapse: collapse; min-width: 320px;">
          ${htmlRows}
        </table>
        ${htmlFiles}
      </div>
    `,
  };
};

module.exports = {
  formatSubmissionEmail,
};
