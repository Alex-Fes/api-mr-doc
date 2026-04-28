const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const initializeSchema = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      reviewText TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      privacyConsent INTEGER NOT NULL DEFAULT 0,
      ip TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS submission_files (
      id TEXT PRIMARY KEY,
      submissionId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      relativePath TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submissionId) REFERENCES submissions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id
      ON submission_files (submissionId);
  `);
};

const createDatabase = (dbPath) => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  initializeSchema(sqlite);

  const insertSubmission = sqlite.prepare(`
    INSERT INTO submissions (
      id,
      name,
      phone,
      reviewText,
      service,
      privacyConsent,
      ip
    ) VALUES (
      @id,
      @name,
      @phone,
      @reviewText,
      @service,
      @privacyConsent,
      @ip
    )
  `);

  const insertFile = sqlite.prepare(`
    INSERT INTO submission_files (
      id,
      submissionId,
      token,
      originalName,
      storedName,
      mimeType,
      sizeBytes,
      relativePath
    ) VALUES (
      @id,
      @submissionId,
      @token,
      @originalName,
      @storedName,
      @mimeType,
      @sizeBytes,
      @relativePath
    )
  `);

  const findFile = sqlite.prepare(`
    SELECT
      id,
      submissionId,
      token,
      originalName,
      storedName,
      mimeType,
      sizeBytes,
      relativePath,
      createdAt
    FROM submission_files
    WHERE token = ?
  `);

  return {
    createSubmission(submission) {
      const row = {
        id: submission.id,
        name: submission.name || '',
        phone: submission.phone || '',
        reviewText: submission.reviewText || '',
        service: submission.service || '',
        privacyConsent: submission.privacyConsent ? 1 : 0,
        ip: submission.ip || '',
      };

      insertSubmission.run(row);
      return { ...submission, id: row.id };
    },

    createSubmissionFile(file) {
      insertFile.run(file);
      return file;
    },

    findFileByToken(token) {
      return findFile.get(token) || null;
    },

    close() {
      sqlite.close();
    },
  };
};

module.exports = {
  createDatabase,
};
