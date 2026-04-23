# Dental Clinic Mail Server

Small Express backend for website forms. It accepts requests from the React app and sends email notifications through SMTP.

## Local Setup

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Fill `server/.env` with real SMTP credentials before starting.

## Environment

```text
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-site.ru
SMTP_HOST=smtp.your-mail-provider.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=site@your-site.ru
SMTP_PASS=mailbox-password
MAIL_FROM=site@your-site.ru
MAIL_TO=info@your-site.ru
MAX_FILE_SIZE_MB=15
MAX_FILES=5
```

`MAIL_FROM` should usually match `SMTP_USER`, otherwise some SMTP providers reject the message.

## API

### `GET /health`

Returns:

```json
{ "success": true, "status": "ok" }
```

### `POST /api/send-email`

Accepts `application/json` and `multipart/form-data`.

Fields:

- `name`: optional
- `phone`: optional, 10 digits
- `reviewText`: optional
- `service`: required
- `privacyConsent`: required, `true`
- `files`: optional multipart attachments

At least `phone` or `reviewText` must be present.

## Timeweb Deployment

1. Upload the `server` folder as a Node.js project.
2. Run `npm install --omit=dev` in the `server` folder.
3. Set the environment variables from `.env.example` in Timeweb or create `server/.env`.
4. Start the app with `npm start`.
5. Check `https://your-backend-url/health`.
6. Build the React app with `REACT_APP_API_URL` pointing to the backend URL.

Example frontend build command on Windows PowerShell:

```powershell
$env:REACT_APP_API_URL='https://your-backend-url'; npm run build
```

Then upload the generated `build` folder to Timeweb as before.
