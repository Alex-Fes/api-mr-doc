# Local File Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist uploaded appointment files and videos on the VPS disk and send email links to those files instead of SMTP attachments.

**Architecture:** Keep `POST /api/send-email` as the submission entry point. Add focused storage modules for SQLite metadata and disk writes, then add `GET /files/:token` for token-based file download links built from `API_URL`.

**Tech Stack:** Node.js 18+, Express, Multer, Nodemailer, SQLite via `better-sqlite3`, built-in `node:test`.

---

## File Structure

- Modify `package.json`: add `test` script and `better-sqlite3` dependency.
- Modify `.env.example`, `.env.stage`, `.env.production`: add `STORAGE_DIR=storage`.
- Modify `.gitignore`: ignore local `storage/` runtime data.
- Modify `src/config.js`: expose `storage.dir`.
- Create `src/storage/database.js`: initialize SQLite schema and provide submission/file metadata functions.
- Create `src/storage/fileStorage.js`: generate IDs/tokens, save uploaded files, resolve download paths safely.
- Create `src/routes/files.js`: implement `GET /files/:token`.
- Modify `src/routes/sendEmail.js`: save uploads before email sending and pass file links to email formatting.
- Modify `src/email/sendMail.js`: stop attaching files, accept saved file link metadata.
- Modify `src/utils/formatSubmission.js`: render file links in text and HTML emails.
- Create `test/*.test.js`: focused unit tests for formatting, path safety, and route behavior where practical.

## Task 1: Add Test Harness and Runtime Config

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `.env.example`
- Modify: `.env.stage`
- Modify: `.env.production`
- Modify: `src/config.js`

- [ ] **Step 1: Add a failing config test**

Create `test/config.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('config exposes storage directory from STORAGE_DIR', () => {
  process.env.FRONTEND_URL = 'https://example.com';
  process.env.API_URL = 'https://api.example.com';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_USER = 'mailer@example.com';
  process.env.SMTP_PASS = 'secret';
  process.env.MAIL_FROM = 'mailer@example.com';
  process.env.MAIL_TO = 'clinic@example.com';
  process.env.STORAGE_DIR = 'custom-storage';

  delete require.cache[require.resolve('../src/config')];
  const config = require('../src/config');

  assert.equal(config.storage.dir, 'custom-storage');
});
```

- [ ] **Step 2: Add test script and run failing test**

Run: `npm test -- --test-name-pattern "config exposes storage"`

Expected: FAIL because `npm test` or `config.storage` does not exist yet.

- [ ] **Step 3: Implement minimal config support**

In `package.json`, add:

```json
"test": "node --test"
```

In `src/config.js`, add:

```js
storage: {
  dir: process.env.STORAGE_DIR || 'storage',
},
```

Add to env files:

```text
STORAGE_DIR=storage
```

Add to `.gitignore`:

```text
storage/
```

- [ ] **Step 4: Verify**

Run: `npm test -- --test-name-pattern "config exposes storage"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore .env.example .env.stage .env.production src/config.js test/config.test.js
git commit -m "test: add storage config coverage"
```

## Task 2: Add SQLite Metadata Store

**Files:**
- Modify: `package.json`
- Create: `src/storage/database.js`
- Create: `test/database.test.js`

- [ ] **Step 1: Install SQLite dependency**

Run: `npm install better-sqlite3`

Expected: package and lockfile update successfully.

- [ ] **Step 2: Write failing database tests**

Create `test/database.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { createDatabase } = require('../src/storage/database');

test('database stores submissions and resolves files by token', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-db-'));
  const db = createDatabase(path.join(dir, 'data.sqlite'));

  const submission = db.createSubmission({
    id: 'submission-1',
    name: 'Anna',
    phone: '9991112233',
    reviewText: 'Video review',
    service: 'Форма сайта',
    privacyConsent: true,
    ip: '127.0.0.1',
  });

  db.createSubmissionFile({
    id: 'file-1',
    submissionId: submission.id,
    token: 'token-1',
    originalName: 'review.mp4',
    storedName: 'file-1.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 12,
    relativePath: 'files/2026/04/submission-1/file-1.mp4',
  });

  assert.equal(db.findFileByToken('token-1').originalName, 'review.mp4');
  assert.equal(db.findFileByToken('missing'), null);
});
```

- [ ] **Step 3: Run failing test**

Run: `npm test -- --test-name-pattern "database stores"`

Expected: FAIL because `src/storage/database.js` does not exist.

- [ ] **Step 4: Implement SQLite store**

Create `src/storage/database.js` with:

- `createDatabase(dbPath)`
- schema initialization for `submissions` and `submission_files`
- `createSubmission(submission)`
- `createSubmissionFile(file)`
- `findFileByToken(token)`

Use parameterized statements only.

- [ ] **Step 5: Verify**

Run: `npm test -- --test-name-pattern "database stores"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/storage/database.js test/database.test.js
git commit -m "feat: add sqlite submission metadata store"
```

## Task 3: Add Disk File Storage

**Files:**
- Create: `src/storage/fileStorage.js`
- Create: `test/fileStorage.test.js`

- [ ] **Step 1: Write failing file storage tests**

Create `test/fileStorage.test.js`:

```js
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
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- --test-name-pattern "saveUploadedFiles|resolveStoredFilePath"`

Expected: FAIL because `src/storage/fileStorage.js` does not exist.

- [ ] **Step 3: Implement file storage**

Create `src/storage/fileStorage.js` with:

- `saveUploadedFiles({ storageDir, submissionId, files, now })`
- `resolveStoredFilePath(storageDir, relativePath)`
- random IDs via `crypto.randomUUID()`
- random tokens via `crypto.randomBytes(32).toString('hex')`
- extension from sanitized original filename using `path.extname`
- writes under `files/YYYY/MM/<submissionId>/`

- [ ] **Step 4: Verify**

Run: `npm test -- --test-name-pattern "saveUploadedFiles|resolveStoredFilePath"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage/fileStorage.js test/fileStorage.test.js
git commit -m "feat: store uploaded files on disk"
```

## Task 4: Add File Links to Email Formatting

**Files:**
- Modify: `src/utils/formatSubmission.js`
- Modify: `src/email/sendMail.js`
- Create: `test/formatSubmission.test.js`

- [ ] **Step 1: Write failing formatter test**

Create `test/formatSubmission.test.js`:

```js
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
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- --test-name-pattern "includes uploaded file links"`

Expected: FAIL because formatter ignores `submission.files`.

- [ ] **Step 3: Implement formatter support**

Update `formatSubmissionEmail(submission)` to append file rows/sections when `submission.files` exists.

Keep HTML escaping for filenames and URLs.

Update `sendSubmissionEmail(submission)` to send no `attachments` field. It should rely on links already included in the formatted submission.

- [ ] **Step 4: Verify**

Run: `npm test -- --test-name-pattern "includes uploaded file links"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatSubmission.js src/email/sendMail.js test/formatSubmission.test.js
git commit -m "feat: include uploaded file links in emails"
```

## Task 5: Wire Submission Flow to Storage

**Files:**
- Modify: `src/routes/sendEmail.js`
- Modify: `src/config.js` if database path helper is needed
- Create: `test/sendEmail.storage.test.js` if route-level testing is practical without large mocking

- [ ] **Step 1: Write route-level or service-level failing test**

Preferred test target: extract submission processing into a testable function if direct Express route testing becomes too coupled.

Expected behavior:

- files are saved to disk;
- submission row is inserted;
- file rows are inserted;
- email receives `submission.files` with URLs built from `config.apiUrl`;
- email attachments are not used.

- [ ] **Step 2: Run failing test**

Run: `npm test -- --test-name-pattern "submission storage"`

Expected: FAIL because route does not save files or build links.

- [ ] **Step 3: Implement wiring**

In `src/routes/sendEmail.js`:

- initialize database using `path.join(config.storage.dir, 'data.sqlite')`;
- create a `submissionId` for every valid submission;
- save uploaded files before sending email;
- insert submission metadata;
- insert each file metadata row;
- build file URLs as `${config.apiUrl}/files/${token}`;
- call `sendSubmissionEmail({ ...submission, id: submissionId, files: savedFilesWithUrls })`.

Preserve current validation and client-facing error messages.

- [ ] **Step 4: Verify**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/sendEmail.js src/config.js test/sendEmail.storage.test.js
git commit -m "feat: persist uploaded files during submissions"
```

## Task 6: Add Download Endpoint

**Files:**
- Create: `src/routes/files.js`
- Modify: `src/index.js`
- Create: `test/filesRoute.test.js`

- [ ] **Step 1: Write failing endpoint test**

Create `test/filesRoute.test.js` using the exported router/app factory if available. If the current app is not testable because `src/index.js` immediately listens, first extract app creation into `src/app.js`.

Expected behavior:

- `GET /files/<known-token>` returns file bytes and headers;
- unknown token returns `404`;
- missing disk file returns `404` or `410` consistently.

- [ ] **Step 2: Run failing test**

Run: `npm test -- --test-name-pattern "GET /files"`

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement router**

Create `src/routes/files.js`:

- look up token using database;
- resolve disk path through `resolveStoredFilePath`;
- set `Content-Type`;
- set `Content-Length`;
- set `Content-Disposition` using original filename;
- send file via `res.sendFile`.

Mount in `src/index.js`:

```js
app.use('/files', filesRouter);
```

- [ ] **Step 4: Verify**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/files.js src/index.js test/filesRoute.test.js
git commit -m "feat: serve stored files by token"
```

## Task 7: Manual Verification and Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Document:

- `STORAGE_DIR`;
- files are stored permanently;
- backup paths;
- file links are `/files/<token>`;
- nginx must not expose `storage/` directly;
- `client_max_body_size` should be >= upload limit.

- [ ] **Step 2: Run full automated verification**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Start local server**

Run: `npm run start:dev`

Expected: server starts on configured port.

- [ ] **Step 4: Submit multipart request manually**

Use a small local test file and `curl` or Postman:

```bash
curl -F "service=Запись на прием" \
  -F "privacyConsent=true" \
  -F "phone=9991112233" \
  -F "files=@README.md;type=text/plain" \
  http://localhost:4000/api/send-email
```

Expected:

- response `{ "success": true }`;
- file exists under `storage/files/...`;
- SQLite has submission and file rows;
- email body contains `http(s)://.../files/<token>`;
- no SMTP attachment is present.

- [ ] **Step 5: Verify download URL**

Open or request the generated file URL.

Expected:

- file downloads or renders;
- original filename appears in `Content-Disposition`;
- unknown token returns `404`.

- [ ] **Step 6: Commit README updates**

```bash
git add README.md
git commit -m "docs: document local file storage"
```

## Final Verification

- [ ] Run `npm test`.
- [ ] Run `git status --short` and confirm only intentional files are changed, or the tree is clean.
- [ ] Confirm no files under `storage/` are tracked.
- [ ] Confirm stage/prod links use `API_URL` and have no duplicated `/api`.
