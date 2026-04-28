const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');
const { createDatabase } = require('../storage/database');
const { resolveStoredFilePath } = require('../storage/fileStorage');

const sanitizeHeaderFilename = (filename) => String(filename || 'file')
  .replace(/["\r\n]/g, '')
  .trim() || 'file';

const createFilesRouter = ({ database, storageDir }) => {
  const router = express.Router();

  router.get('/:token', async (req, res, next) => {
    try {
      const file = database.findFileByToken(req.params.token);

      if (!file) {
        res.status(404).json({
          success: false,
          error: 'Файл не найден',
        });
        return;
      }

      const absolutePath = resolveStoredFilePath(storageDir, file.relativePath);
      let stats;

      try {
        stats = await fs.stat(absolutePath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          res.status(404).json({
            success: false,
            error: 'Файл не найден',
          });
          return;
        }

        throw error;
      }

      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', stats.size);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizeHeaderFilename(file.originalName)}"`,
      );
      res.sendFile(absolutePath, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

const database = createDatabase(path.join(config.storage.dir, 'data.sqlite'));
const filesRouter = createFilesRouter({
  database,
  storageDir: config.storage.dir,
});

module.exports = filesRouter;
module.exports.createFilesRouter = createFilesRouter;
