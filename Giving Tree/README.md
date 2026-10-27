# 3-7FA Giving Tree

Responsive, plain HTML/CSS/JavaScript website with a Node.js HTTP API, SQLite storage, staff-only application dashboard, Azure Communication Services Email adapter, and restricted Google Sheets sync. Database migrations are in `server/migrations/` and contain schema only (no seed data). This is a local-first scaffold; it does not provision cloud resources or choose a hosting provider.

## Local setup

Requirements: Node.js 22.13 or later (uses the built-in `node:sqlite`; no npm packages are required).

1. From this folder, copy `.env.example` to `.env`.
2. Create at least one staff password hash:

   ```text
   node server/hash-password.mjs
   ```

   Enter a 14+ character password when prompted; input is hidden. Put the resulting `salt:hash` in `ADMIN_USERS_JSON`. Example (single-line JSON):

   ```text
   ADMIN_USERS_JSON='[{"email":"staff@example.org","role":"admin","passwordHash":"PASTE_SALT:HASH_HERE"}]'
   ```

   Add staff individually with role `admin` or `reviewer`. Do not add a public registration route. `reviewer` can view applications but cannot change status or read the audit endpoint; `admin` can do those actions.
3. Run `npm run check`, `npm test`, and `npm start`.
4. Open `http://127.0.0.1:3000/`; staff sign in at `http://127.0.0.1:3000/admin`.

The local server binds to loopback by default. Keep it private; do not expose this development server directly to the internet. The local database is created at `data/giving-tree.sqlite`, excluded from source control. Local mode logs warnings when email, Sheets, or the retention period is not configured. Applications still save when an optional local integration is unset or temporarily fails.

## Configuration and integrations

The server loads `.env` without third-party dependencies. Existing process environment variables take precedence. Keep `.env`, database files, service-account keys, and provider credentials private.

| Variable | Purpose |
| --- | --- |
| `HOST`, `PORT` | Listener address and port; defaults to `127.0.0.1:3000`. |
| `DB_PATH` | SQLite file path; defaults to `./data/giving-tree.sqlite`. |
| `ADMIN_USERS_JSON` | Staff identity list: email, `admin`/`reviewer` role, and scrypt password hash. No default credentials. |
| `AGE_BANDS` | Comma-separated age-band options; must match the form choices. Default is `0–2,3–4,5–6,7–8,9–12,13+`. |
| `ACS_ENDPOINT`, `ACS_ACCESS_KEY`, `ACS_SENDER_ADDRESS` | Azure Communication Services Email REST configuration. |
| `STAFF_NOTIFICATION_EMAIL` | Authorized program mailbox for generic new-application notifications. |
| `ADMIN_URL` | Secure dashboard URL in notification emails; production must use HTTPS. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service-account JSON for the backend only. |
| `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_RANGE` | Dedicated restricted spreadsheet and append range; default range is `GivingTree!A:S`. |
| `RETENTION_DAYS` | **Pre-launch blocker until decided by the program.** Whole days, 1–3650. Production startup refuses to run without an approved value. |

For Google Sheets, provision a dedicated, access-restricted spreadsheet with these columns in order: `application_id`, `guardian_name`, `guardian_email`, `battery`, `child_number`, `age_band`, `gender`, `interests`, `wish_list_item_1`, `wish_list_item_2`, `wish_list_item_3`, `wish_list_item_4`, `sensory_allergy_concerns`, `shirt_size`, `pants_size`, `shoe_size`, `status`, `created_at`, and `updated_at`. Share only that spreadsheet with the integration service account using the minimum writer permission needed to append rows; do not use a personal owner's credentials. Each application and status update appends one row per child. The sheet contains guardian names and email addresses, the selected battery, and children's age bands, gender, required clothing sizes, interests, optional wish-list items, and sensory and allergy concerns (which may include sensitive health information). The application form explicitly asks the guardian to acknowledge this copy. Do not share the sheet publicly or with donors. Restrict its access to authorized program staff and approve a separate retention/deletion policy for the sheet; application database retention does not delete historical Google Sheet rows.

Email messages are generic. Family confirmations and status-update messages include no name, age, gender, interests, or application status. Staff notifications contain only a general notice and dashboard sign-in URL; staff must sign in to view private details. No application details are put in email subjects or bodies.

### Privacy, retention, and launch gate

- The required fields are parent/guardian name and email, battery selection, plus age band, gender, shirt size, pants size, shoe size, interests, and sensory and allergy concerns for each child (up to 10 children in one family application). Four optional wish-list item fields are also available for each child. The sensory/allergy field may contain sensitive health information; diagnoses, treatment details, birth date, government IDs, financial data, volunteer registration, donor/gift matching, and payment collection remain out of scope. The application requires acknowledgement that submitted child details are copied to a restricted program Google Sheet accessible to authorized staff.
- Application data is private. The public API has no application-list or application-detail route. Staff sessions are opaque, random, HttpOnly, SameSite=Strict cookies; state-changing admin requests require a CSRF token. Staff passwords use scrypt hashes. Staff access and status changes are written to the audit table.
- Public submissions and sign-in attempts have per-process IP rate limits; payload size and fields are validated server-side. The database is local SQLite and is not encrypted by application code. Production hosting must provide encrypted storage/backups, private network ingress, TLS termination, restricted access, monitoring, and secure secret storage.
- `RETENTION_DAYS` is deliberately unset in the example because the program has not chosen a period. Once approved, the server deletes expired application records at startup and every 24 hours. Audit records are retained but their expired application-ID links are cleared. **Google Sheets contains guardian contact details and children's personal information; its access and retention/deletion policy must be approved and managed before launch** (this scaffold does not automatically delete historical sheet rows).
- Production startup requires approved retention days, at least one staff identity, HTTPS `ADMIN_URL`, Azure Email configuration, a configured Sheets integration, and a staff notification address. No cloud services are provisioned by this project.
- Before launch, configure an HTTPS reverse proxy/private network, encrypted durable database and backups, distributed rate limiting if multi-instance, and a shared session strategy if horizontally scaled. Review consent/notice, role assignments, spreadsheet access, email sender approval, and the retention policy. The default in-memory rate limiter and single local SQLite file are intended for local validation, not a multi-instance deployment.

## API outline

- `GET /api/health` — non-sensitive health response.
- `GET /api/config` — public age-band options only.
- `POST /api/applications` — validate and save a family application with a `children` array; returns a generic acknowledgement only.
- `POST /api/admin/login` — authenticate configured staff; no account creation.
- `GET /api/admin/me` — current staff role and CSRF token, or `401`.
- `GET /api/admin/applications` — authorized dashboard data; access is audited.
- `PATCH /api/admin/applications/:id/status` — administrator-only status change (`pending`, `approved`, `declined`, `closed`), audited and synced as a minimal Sheets row.
- `GET /api/admin/audit` — administrator-only audit history.
- `POST /api/admin/logout` — revoke current session.

## Verification

```text
npm run check
npm test
```

Tests use temporary SQLite databases and stub provider calls; they do not contact Azure or Google.
