# Wraith

A deliberately narrow, self-hosted bridge from Make to one WhatsApp group. It links a personal WhatsApp account by QR and exposes only `POST /v1/messages`. Callers supply message text—not a phone number, chat ID, or group ID.

> **Unofficial integration:** Baileys implements the WhatsApp Web protocol and is not endorsed by Meta. WhatsApp changes can break it, and automated use may create account-restriction risk. Keep volume low and use only with a group whose members expect these messages.

## Security model

- Binds to `127.0.0.1` by default; do not expose it directly to the public internet.
- Uses a long bearer token and constant-time comparison.
- Resolves one exact group name on the linked account; duplicate names fail closed.
- Encrypts the entire Baileys credential/key state with AES-256-GCM and writes it with mode `0600`.
- Displays pairing QR only in the local process console; there is no pairing web route.
- Limits body size, message length, and request rate. Logs metadata, never message text or credentials.

The encryption key must be stored separately from `data/session.enc`. Environment variables are a reasonable starting point on one Mac; a production server should inject them through its secret manager. Anyone who controls the running host can still access the linked WhatsApp session, so keep the host patched, encrypted, and access-controlled.

## Setup

Requires Node.js 20 or newer.

```sh
npm install
npm run secrets
cp .env.example .env
```

Put the generated secrets and exact group name into `.env`, then load it and start:

```sh
set -a
source .env
set +a
npm run dev
```

Scan the terminal QR from **WhatsApp → Settings → Linked devices → Link a device**. The service refuses to become ready unless exactly one participating group has `TARGET_GROUP_NAME`.

Check readiness:

```sh
curl http://127.0.0.1:8787/readyz
```

Send a test:

```sh
curl -X POST http://127.0.0.1:8787/v1/messages \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Your verification code is 123456"}'
```

## Make integration

Use **HTTP → Make a request**:

- Method: `POST`
- URL: a private HTTPS URL that securely reaches this service
- Header: `Authorization: Bearer <API_TOKEN>`
- Header: `Content-Type: application/json`
- Body: `{ "text": "{{your extracted code/message}}" }`

For a Mac on a home network, use a private overlay network or an authenticated tunnel; keep the app bound to loopback. Do not port-forward `8787` from the router. If the tunnel already authenticates access, retain the API bearer token as a second layer.

## Operations

- Back up `data/session.enc` only if you also have a secure backup of the separate encryption key.
- To revoke access, remove this linked device inside WhatsApp.
- To pair again, stop the service, move `data/session.enc` to a safe backup location, and restart.
- `GET /healthz` proves the HTTP process is alive; `GET /readyz` returns 200 only after WhatsApp connects and the configured group resolves.
