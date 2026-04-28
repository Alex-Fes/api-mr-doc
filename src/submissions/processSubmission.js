const crypto = require('node:crypto');
const { saveUploadedFiles } = require('../storage/fileStorage');

const buildFileUrl = (apiUrl, token) => `${apiUrl.replace(/\/$/, '')}/files/${token}`;

const processSubmission = async ({
  submission,
  files = [],
  config,
  database,
  sendSubmissionEmail,
  createSubmissionId = crypto.randomUUID,
  now = new Date(),
}) => {
  const submissionId = createSubmissionId();
  const submissionWithId = {
    ...submission,
    id: submissionId,
  };

  database.createSubmission(submissionWithId);

  const savedFiles = await saveUploadedFiles({
    storageDir: config.storage.dir,
    submissionId,
    files,
    now,
  });

  const filesWithUrls = savedFiles.map((file) => {
    const fileRecord = {
      ...file,
      submissionId,
    };

    database.createSubmissionFile(fileRecord);

    return {
      ...fileRecord,
      url: buildFileUrl(config.apiUrl, file.token),
    };
  });

  await sendSubmissionEmail({
    ...submissionWithId,
    files: filesWithUrls,
  });
};

module.exports = {
  processSubmission,
  buildFileUrl,
};
