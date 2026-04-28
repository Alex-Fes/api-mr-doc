const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const toPosixPath = (...segments) => segments.join('/');

const getMonthPath = (date) => {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return { year, month };
};

const sanitizeExtension = (filename) => {
  const extension = path.extname(filename || '').toLowerCase();
  return /^[a-z0-9.]+$/.test(extension) ? extension : '';
};

const resolveStoredFilePath = (storageDir, relativePath) => {
  const storageRoot = path.resolve(storageDir);
  const resolvedPath = path.resolve(storageRoot, relativePath);
  const relativeToRoot = path.relative(storageRoot, resolvedPath);

  if (
    relativeToRoot.startsWith('..')
    || path.isAbsolute(relativeToRoot)
    || relativeToRoot === ''
  ) {
    throw new Error('Invalid file path');
  }

  return resolvedPath;
};

const saveUploadedFiles = async ({
  storageDir,
  submissionId,
  files,
  now = new Date(),
}) => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const { year, month } = getMonthPath(now);
  const relativeDir = toPosixPath('files', year, month, submissionId);
  const absoluteDir = resolveStoredFilePath(storageDir, relativeDir);

  await fs.mkdir(absoluteDir, { recursive: true });

  const savedFiles = [];

  for (const file of files) {
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const storedName = `${id}${sanitizeExtension(file.originalname)}`;
    const relativePath = toPosixPath(relativeDir, storedName);
    const absolutePath = resolveStoredFilePath(storageDir, relativePath);

    await fs.writeFile(absolutePath, file.buffer);

    savedFiles.push({
      id,
      token,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: Number.isFinite(file.size) ? file.size : file.buffer.length,
      relativePath,
    });
  }

  return savedFiles;
};

module.exports = {
  saveUploadedFiles,
  resolveStoredFilePath,
};
