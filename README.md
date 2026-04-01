# scraper-service

![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![CD](https://img.shields.io/badge/CD-GitHub_Deploy-2ea44f?logo=github&logoColor=white)
![Container](https://img.shields.io/badge/Container-GHCR-2496ED?logo=docker&logoColor=white)

Сервис автоматического сбора данных с открытых веб-источников.

## Что делает этот репозиторий

- запускает задания сбора данных по cron;
- формирует raw-события формата `source.raw.v1`;
- валидирует события по JSON Schema;
- публикует события в RabbitMQ;
- загружает артефакты в S3/MinIO, если они есть.

## Источники

- `demo-source` (`src/sources/demo-source.ts`) - self-contained fallback для локального pipeline, не зависит от внешней сети и по умолчанию генерирует несколько полезных raw-событий.
- `find-tender` (`src/sources/find-tender-source.ts`) - пример реального источника, включается через `ENABLED_SOURCES`.

## Flow

`node-cron` -> source adapter -> optional artifacts upload -> raw event build -> JSON Schema validate -> publish to `source.raw.v1`

Особенности:

- если source возвращает несколько items, сервис публикует каждый item отдельно;
- ошибка одного item не валит весь source run;
- ошибка upload конкретного артефакта логируется явно, а raw event публикуется дальше без этого артефакта;
- ошибки source adapter изолированы, scheduler продолжает работать для остальных источников;
- при repeated failures остается активной retry/circuit breaker логика.

## Локальный запуск

```bash
cp .env.example .env
npm install
npm run start:dev
```

Для локального end-to-end сценария обычно нужен поднятый RabbitMQ и MinIO из `deployment-infra`:

```bash
cd ../deployment-infra
cp .env.example .env
make up
```

## ENABLED_SOURCES

Значение читается из env как список через запятую.

Только demo fallback:

```env
ENABLED_SOURCES=demo-source
```

Demo + реальный источник:

```env
ENABLED_SOURCES=demo-source,find-tender
```

Если указан только неизвестный source, сервис залогирует предупреждение и включит `demo-source` как fallback.

## Важные env переменные

- `RABBITMQ_URL`
- `QUEUE_RAW_EVENT`
- `QUEUE_QUARANTINE_EVENT`
- `SCRAPE_SCHEDULE`
- `SHARED_CONTRACTS_DIR`
- `ENABLED_SOURCES`
- `DEMO_SOURCE_BASE_URL`
- `DEMO_SOURCE_ITEM_COUNT`
- `FIND_TENDER_API_URL`
- `REQUEST_TIMEOUT_MS`
- `RETRY_ATTEMPTS`
- `RETRY_BASE_DELAY_MS`
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD`
- `CIRCUIT_BREAKER_OPEN_MS`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `S3_FORCE_PATH_STYLE`
- `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` - optional, если окружение требует outbound proxy для реальных источников

## Связи с другими репозиториями

- публикует события для `processing-worker`;
- использует контракты из `shared-contracts`.

## Как проверить локально

### 1. Demo-source публикует raw events

1. Подними инфраструктуру из `deployment-infra`.
2. В `scraper-service/.env` оставь:

```env
ENABLED_SOURCES=demo-source
SCRAPE_SCHEDULE=*/20 * * * *
```

3. Запусти `npm run start:dev`.
4. В логах должны появиться сообщения:
   - `loaded enabled sources`
   - `scheduled run started`
   - `source run started`
   - `items collected`
   - `raw event published`

Проверка очереди через RabbitMQ management API:

```bash
curl -u app:app http://localhost:15672/api/queues/%2F/source.raw.v1
```

Проверка содержимого очереди через контейнер RabbitMQ:

```bash
docker exec -it deployment-infra-rabbitmq-1 rabbitmqadmin get queue=source.raw.v1 count=5 ackmode=ack_requeue_true
```

### 2. Upload артефактов работает

У `demo-source` первый item публикуется с HTML-артефактом. После запуска проверь bucket:

```bash
docker exec -it deployment-infra-minio-init-1 mc ls --recursive local/scraper-artifacts
```

Если MinIO недоступен, в логах появится `artifact upload failed; continuing without this artifact`, а публикация raw event продолжится.

### 3. Падение одного source не роняет сервис

Включи одновременно demo и реальный source:

```env
ENABLED_SOURCES=demo-source,find-tender
```

Если `find-tender` недоступен, в логах будут `source run failed` и при повторных ошибках сообщения про `circuit breaker is open`, но `demo-source` продолжит публиковать события.

### 4. Источники грузятся из env

Запусти сервис с разными значениями `ENABLED_SOURCES` и смотри лог `loaded enabled sources`.

Примеры:

```env
ENABLED_SOURCES=demo-source
ENABLED_SOURCES=demo-source,find-tender
ENABLED_SOURCES=find-tender,unknown-source
```

В последнем случае сервис отдельно залогирует неизвестный source и загрузит только известные.
