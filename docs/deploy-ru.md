# Деплой backend на stage и production

Документ описывает порядок действий на сервере для `dental-clinic-mail-server`. Backend простой: Express-приложение принимает заявки, сохраняет загруженные файлы в локальное хранилище и отправляет уведомления через SMTP.

## Что важно знать заранее

- Требуется Node.js `18+`.
- Приложение запускается из env-файла:
  - stage: `npm run start:stage` читает `.env.stage`;
  - production: `npm run start:prod` читает `.env.production`.
- Healthcheck: `GET /health`, успешный ответ: `{"status":"ok"}`.
- Отправка формы: `POST /api/send-email`.
- Скачивание загруженных файлов: `GET /files/:token`.
- `API_URL` используется в письмах для ссылок на файлы.
- `FRONTEND_URL` должен точно совпадать с доменом frontend, иначе CORS заблокирует запрос.
- `MAIL_FROM` обычно должен совпадать с `SMTP_USER`, иначе SMTP-провайдер может отклонить письмо.
- `STORAGE_DIR` содержит постоянные данные: `data.sqlite` и папку `files/`. Это надо бэкапить.

Если stage и production работают на разных серверах, можно оставить один и тот же `PORT` в обоих env. Если stage и production работают одновременно на одном VPS, им нужны разные порты и разные директории хранения.

Рекомендуемая схема портов для одного VPS: наружу смотрит только nginx на `80/443`, а Node.js-приложения слушают локальные порты на `127.0.0.1`. Для этого проекта используем диапазон `3000-3099`.

```text
/var/www/node-apps/api-mr-doc-stage      PORT=3001, STORAGE_DIR=storage
/var/www/node-apps/api-mr-doc-production PORT=3003, STORAGE_DIR=storage
```

Так stage и production не делят SQLite-базу и загруженные файлы.

## 1. Подготовить сервер

Установить Node.js, npm, nginx и pm2.

Пример для Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y nginx git ca-certificates curl build-essential

node -v
npm -v
```

Если Node.js ниже `18`, установить актуальную LTS-версию через NodeSource, nvm или пакетный менеджер хостинга.

PM2 нужен, чтобы процесс переживал закрытие SSH-сессии и автоматически стартовал после перезагрузки:

```bash
sudo npm install -g pm2
```

## 2. Разложить проект по директориям

Для stage:

```bash
sudo mkdir -p /var/www/node-apps/api-mr-doc-stage
sudo chown -R "$USER":"$USER" /var/www/node-apps/api-mr-doc-stage
git clone <repo-url> /var/www/node-apps/api-mr-doc-stage
cd /var/www/node-apps/api-mr-doc-stage
```

Для production на том же VPS:

```bash
sudo mkdir -p /var/www/node-apps/api-mr-doc-production
sudo chown -R "$USER":"$USER" /var/www/node-apps/api-mr-doc-production
git clone <repo-url> /var/www/node-apps/api-mr-doc-production
cd /var/www/node-apps/api-mr-doc-production
```

Если код уже загружен без git, просто перейти в директорию проекта.

## 3. Настроить env для stage

Открыть stage env:

```bash
cd /var/www/node-apps/api-mr-doc-stage
nano .env.stage
```

Минимальный набор значений:

```dotenv
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://mr-doc.univpro.ru
API_URL=https://api-mr-doc.univpro.ru

SMTP_HOST=smtp.timeweb.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@mr-doc.univpro.ru
SMTP_PASS=<real-password>

MAIL_FROM=info@mr-doc.univpro.ru
MAIL_TO=<recipient-email>

MAX_FILE_SIZE_MB=15
MAX_FILES=5
STORAGE_DIR=storage
```

Проверить, что `SMTP_PASS` заполнен реальным паролем, а `MAIL_TO` ведет на нужный адрес получателя заявок.

## 4. Настроить env для production

Открыть production env:

```bash
cd /var/www/node-apps/api-mr-doc-production
nano .env.production
```

Если production работает на том же VPS, поставить другой порт, например `3003`:

```dotenv
PORT=3003
NODE_ENV=production
FRONTEND_URL=https://mr-doc.ru
API_URL=https://api.mr-doc.ru

SMTP_HOST=<smtp-host>
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<smtp-user>
SMTP_PASS=<real-password>

MAIL_FROM=<smtp-user>
MAIL_TO=<recipient-email>

MAX_FILE_SIZE_MB=15
MAX_FILES=5
STORAGE_DIR=storage
```

Если production на отдельном сервере, `PORT=3001` тоже подходит. Но для порядка на общей VPS лучше вести таблицу портов и не переиспользовать их между проектами.

## 5. Установить зависимости

В каждой директории выполнить:

```bash
npm ci --omit=dev
```

Если `npm ci` падает на сборке `better-sqlite3`, проверить, что на сервере установлены `build-essential` и подходящая версия Node.js.

## 6. Создать директорию storage

В каждой директории выполнить:

```bash
mkdir -p storage/files
```

Не раздавать `storage` напрямую через nginx. Файлы должны открываться только через endpoint `/files/:token`.

## 7. Запустить через PM2

Stage:

```bash
cd /var/www/node-apps/api-mr-doc-stage
pm2 start npm --name api-mr-doc-stage -- run start:stage
```

Production:

```bash
cd /var/www/node-apps/api-mr-doc-production
pm2 start npm --name api-mr-doc-production -- run start:prod
```

Проверить процессы:

```bash
pm2 list
pm2 logs api-mr-doc-stage
pm2 logs api-mr-doc-production
```

Сохранить автозапуск:

```bash
pm2 save
pm2 startup
```

Команда `pm2 startup` выведет еще одну команду с `sudo`; ее нужно скопировать и выполнить.

## 8. Настроить nginx для stage

Создать конфиг:

```bash
sudo nano /etc/nginx/sites-available/api-mr-doc-stage
```

Содержимое до выпуска HTTPS-сертификата:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api-mr-doc.univpro.ru;

    client_max_body_size 100m;

    location ^~ /storage/ {
        return 404;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    access_log /var/log/nginx/api-mr-doc-stage.access.log;
    error_log /var/log/nginx/api-mr-doc-stage.error.log;
}
```

Включить сайт:

```bash
sudo ln -s /etc/nginx/sites-available/api-mr-doc-stage /etc/nginx/sites-enabled/api-mr-doc-stage
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Настроить nginx для production

Создать конфиг:

```bash
sudo nano /etc/nginx/sites-available/api-mr-doc-production
```

Если production запущен на `PORT=3003`, содержимое до выпуска HTTPS-сертификата такое:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.mr-doc.ru;

    client_max_body_size 100m;

    location ^~ /storage/ {
        return 404;
    }

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    access_log /var/log/nginx/api-mr-doc-production.access.log;
    error_log /var/log/nginx/api-mr-doc-production.error.log;
}
```

Включить сайт:

```bash
sudo ln -s /etc/nginx/sites-available/api-mr-doc-production /etc/nginx/sites-enabled/api-mr-doc-production
sudo nginx -t
sudo systemctl reload nginx
```

`client_max_body_size` должен быть больше или равен лимитам загрузки файлов. Сейчас приложение по умолчанию разрешает до `MAX_FILES * MAX_FILE_SIZE_MB`, но один файл не больше `MAX_FILE_SIZE_MB`. При `MAX_FILE_SIZE_MB=15` и `MAX_FILES=5` обычно достаточно `100m`. `300m` тоже будет работать, но это избыточно для текущих лимитов backend.

`location ^~ /storage/ { return 404; }` оставляем как дополнительную защиту. Файлы должны отдаваться только через backend endpoint `/files/:token`, а не напрямую из директории `storage`.

## 10. Подключить HTTPS

После того как DNS доменов указывает на сервер, выпустить сертификаты:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api-mr-doc.univpro.ru
sudo certbot --nginx -d api.mr-doc.ru
```

Проверить автообновление:

```bash
sudo certbot renew --dry-run
```

После certbot nginx-конфиг будет похож на такой stage-вариант:

```nginx
server {
    server_name api-mr-doc.univpro.ru;

    client_max_body_size 100m;

    location ^~ /storage/ {
        return 404;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    access_log /var/log/nginx/api-mr-doc-stage.access.log;
    error_log /var/log/nginx/api-mr-doc-stage.error.log;

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/api-mr-doc.univpro.ru/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/api-mr-doc.univpro.ru/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = api-mr-doc.univpro.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;

    server_name api-mr-doc.univpro.ru;
    return 404; # managed by Certbot
}
```

Для production используется тот же шаблон, но:

```text
server_name api.mr-doc.ru;
proxy_pass http://127.0.0.1:3003;
ssl_certificate /etc/letsencrypt/live/api.mr-doc.ru/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.mr-doc.ru/privkey.pem;
```

Если certbot выпустил общий сертификат, например в `/etc/letsencrypt/live/mr-doc.univpro.ru/`, его можно использовать для API-домена только если сертификат реально включает `api-mr-doc.univpro.ru`. Проверить можно через браузер или командой:

```bash
openssl x509 -in /etc/letsencrypt/live/mr-doc.univpro.ru/fullchain.pem -noout -text | grep DNS
```

## 10.1. Перенос `mr-doc.ru` на этот VPS

Дефолтный nginx-конфиг Debian лучше не смешивать с новым проектом. Он может оставаться для `univpro.ru`, но `mr-doc.ru` и `api.mr-doc.ru` лучше вынести в отдельные файлы в `/etc/nginx/sites-available/`.

Перед переключением DNS проверить, что production env backend уже настроен под новый домен:

```dotenv
PORT=3003
FRONTEND_URL=https://mr-doc.ru
API_URL=https://api.mr-doc.ru
```

DNS-записи для переноса:

```text
mr-doc.ru      A     <ip-этого-vps>
www.mr-doc.ru  A     <ip-этого-vps>
api.mr-doc.ru  A     <ip-этого-vps>
```

Если используется IPv6, добавить такие же `AAAA`-записи. Если IPv6 не настроен на сервере, `AAAA` лучше не добавлять.

Backend API-конфиг:

```bash
sudo nano /etc/nginx/sites-available/api-mr-doc-production
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.mr-doc.ru;

    client_max_body_size 100m;

    location ^~ /storage/ {
        return 404;
    }

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    access_log /var/log/nginx/api-mr-doc-production.access.log;
    error_log /var/log/nginx/api-mr-doc-production.error.log;
}
```

Frontend-конфиг, если сборка frontend лежит на этом же VPS:

```bash
sudo nano /etc/nginx/sites-available/mr-doc-production
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name mr-doc.ru www.mr-doc.ru;

    root /var/www/mr-doc-production/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    access_log /var/log/nginx/mr-doc-production.access.log;
    error_log /var/log/nginx/mr-doc-production.error.log;
}
```

Путь `/var/www/mr-doc-production/build` заменить на реальную директорию, куда кладется production-сборка frontend. Если frontend обслуживается другим способом, этот блок не нужен.

Включить конфиги:

```bash
sudo ln -s /etc/nginx/sites-available/api-mr-doc-production /etc/nginx/sites-enabled/api-mr-doc-production
sudo ln -s /etc/nginx/sites-available/mr-doc-production /etc/nginx/sites-enabled/mr-doc-production
sudo nginx -t
sudo systemctl reload nginx
```

После того как DNS уже указывает на VPS, выпустить HTTPS:

```bash
sudo certbot --nginx -d api.mr-doc.ru
sudo certbot --nginx -d mr-doc.ru -d www.mr-doc.ru
```

Проверить:

```bash
curl http://127.0.0.1:3003/health
curl https://api.mr-doc.ru/health
curl -I https://mr-doc.ru
```

Если `api.mr-doc.ru` открывается, но frontend-заявка падает по CORS, проверить, что в `.env.production` backend стоит ровно `FRONTEND_URL=https://mr-doc.ru` и frontend реально открывается с этого origin.

## 11. Проверить запуск

Проверить локально на сервере:

```bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3003/health
```

Проверить через домены:

```bash
curl https://api-mr-doc.univpro.ru/health
curl https://api.mr-doc.ru/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

После этого отправить тестовую заявку с frontend и проверить:

- заявка дошла на `MAIL_TO`;
- в письме корректные ссылки на файлы;
- ссылки ведут на правильный API-домен из `API_URL`;
- CORS не ругается в браузере.

## 12. Как обновлять backend

Stage:

```bash
cd /var/www/node-apps/api-mr-doc-stage
git pull
npm ci --omit=dev
pm2 restart api-mr-doc-stage
curl https://api-mr-doc.univpro.ru/health
```

Production:

```bash
cd /var/www/node-apps/api-mr-doc-production
git pull
npm ci --omit=dev
pm2 restart api-mr-doc-production
curl https://api.mr-doc.ru/health
```

Порядок обновления лучше такой:

1. Обновить stage.
2. Проверить `/health`.
3. Отправить тестовую заявку со stage frontend.
4. Если все нормально, обновить production.
5. Проверить `/health` и отправить тестовую production-заявку.

## 13. Бэкапы

Бэкапить нужно директорию `STORAGE_DIR`, потому что там лежат файлы заявок и SQLite-база:

```text
storage/data.sqlite
storage/files/
```

Минимальный ручной бэкап:

```bash
cd /var/www/node-apps/api-mr-doc-production
tar -czf api-mr-doc-storage-$(date +%F).tar.gz storage
```

Для production лучше настроить регулярный бэкап на внешний диск, S3-compatible storage или backup-сервис хостинга.

## 14. Быстрая диагностика

Проверить процессы:

```bash
pm2 list
```

Посмотреть логи:

```bash
pm2 logs api-mr-doc-stage
pm2 logs api-mr-doc-production
```

Проверить nginx:

```bash
sudo nginx -t
sudo systemctl status nginx
```

Частые причины проблем:

- `Missing required environment variables` - не заполнен обязательный env.
- `Origin not allowed` - `FRONTEND_URL` не совпадает с реальным доменом frontend.
- Письмо не отправляется - неверные `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` или `MAIL_FROM`.
- Ссылки на файлы ведут не туда - неверный `API_URL`.
- 413 от nginx - увеличить `client_max_body_size`.
- Файл не скачивается - проверить, что `storage/data.sqlite` и `storage/files/` принадлежат пользователю, от которого запущен PM2-процесс.
