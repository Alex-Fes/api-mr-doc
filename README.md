# Dental Clinic Mail Server

Small Express backend for website forms. It accepts requests from the React app and sends email notifications through SMTP.

## Environments

The backend supports separate env files for each target:

- `.env.development`
- `.env.stage`
- `.env.production`

The environment names are aligned with the frontend where possible:

- `API_URL`
- `FRONTEND_URL`
- `PORT`

The frontend keeps `REACT_APP_API_URL` because CRA only exposes browser variables with the `REACT_APP_` prefix.

## Local Setup

```bash
npm install
npm run start:dev
```

Fill `.env.development` with real SMTP credentials before starting.

## Environment

```text
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://mr-doc.univpro.ru
API_URL=https://api-mr-doc.univpro.ru
SMTP_HOST=smtp.your-mail-provider.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mailer@example.ru
SMTP_PASS=change-me
MAIL_FROM=mailer@example.ru
MAIL_TO=clinic@example.ru
MAX_FILE_SIZE_MB=15
MAX_FILES=5
STORAGE_DIR=storage
```

`MAIL_FROM` should usually match `SMTP_USER`, otherwise some SMTP providers reject the message.

`STORAGE_DIR` is used for permanent local upload storage. Uploaded files are saved on the VPS disk and email notifications include links to those files instead of SMTP attachments.

## Commands

- `npm run start:dev` starts the backend with `.env.development`
- `npm run start:stage` starts the backend with `.env.stage`
- `npm run start:prod` starts the backend with `.env.production`
- `npm run dev:env` starts local watch mode with `.env.development`

## API

### `GET /health`

Returns:

```json
{ "status": "ok" }
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

Uploaded files are stored permanently under `STORAGE_DIR/files/`, and metadata is stored in `STORAGE_DIR/data.sqlite`. Email file links use `API_URL` and have this shape:

```text
https://api.mr-doc.ru/files/<token>
https://api-mr-doc.univpro.ru/files/<token>
```

There is no `/api` segment in file links.

### `GET /files/:token`

Downloads a stored uploaded file by its unguessable token.

Returns `404` when the token is unknown or the file is missing on disk.

Do not expose `STORAGE_DIR` directly through nginx or `express.static`; file access should go through this endpoint.

## Upload Storage and Backups

Uploaded files are permanent clinic data. Back up both:

```text
storage/data.sqlite
storage/files/
```

The application does not auto-delete uploaded files.

## Deployment Behind nginx

The same branch is used for both staging and production. Only the chosen env file and command change.

### Staging

Staging targets:

- frontend: `https://mr-doc.univpro.ru`
- API: `https://api-mr-doc.univpro.ru`
- local backend bind: `http://127.0.0.1:4000`

1. Upload this project as a separate Node.js app on the VPS.
2. Run `npm install --omit=dev`.
3. Fill `.env.stage` with the real SMTP values.
4. Start the app with `npm run start:stage` or your process manager.
5. Configure nginx to proxy `api-mr-doc.univpro.ru` to `127.0.0.1:4000`.
6. Build the React app with `npm run build:stage`.

### Production

Production targets:

- frontend: `https://mr-doc.ru`
- API: `https://api.mr-doc.ru`
- local backend bind: `http://127.0.0.1:4000`

1. Upload this project as a separate Node.js app on the VPS.
2. Run `npm install --omit=dev`.
3. Fill `.env.production` with the real SMTP values.
4. Start the app with `npm run start:prod` or your process manager.
5. Configure nginx to proxy `api.mr-doc.ru` to `127.0.0.1:4000`.
6. Build the React app with `npm run build:prod`.

Example nginx server block:

```nginx
server {
    listen 80;
    server_name api-mr-doc.univpro.ru;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;
    }
}
```

Keep `client_max_body_size` greater than or equal to the configured upload limits.
