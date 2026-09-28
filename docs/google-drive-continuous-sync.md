# Paguro Finance V1 — Continuous Google Drive Synchronization Architecture

## 1. Executive Summary & Dual Financial Entry Architecture

Paguro Finance V1 supports two independent, authoritative financial data entry paths that feed into the exact same financial intelligence, tax mapping, and reporting system:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       1. AUTOMATIC PATH         │       │        2. MANUAL PATH           │
│   Google Drive Accounting Tree  │       │    User Direct Web Entry        │
│    (Tax receipts, invoices)     │       │   (Cash, ad-hoc, untracked)     │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │ (Read-Only Synchronization)              │
                 ▼                                          ▼
   ┌───────────────────────────┐              ┌───────────────────────────┐
   │ Google Drive Changes API  │              │ Manual Movement Creator   │
   │ (Incremental Page Token)  │              │ (source = 'MANUAL')       │
   └─────────────┬─────────────┘              └────────────┬──────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       Authoritative Financial Architecture      │
             │   - documents table (source status & audit)     │
             │   - financial_movements (ledger & cash flow)    │
             │   - obligations, tax mapping & analytics        │
             └─────────────────────────────────────────────────┘
```

### Critical Architectural Invariants
1. **Unidirectional Documentary Sync**: Google Drive is strictly the documentary source. Paguro Finance **never** modifies or edits original files in Google Drive.
2. **Document & Movement Preservation**: Deleting a file in Google Drive never deletes financial records or audit trails in Paguro Finance.
3. **Human Verified Precedence**: User-verified data always takes precedence over newly synchronized Drive data. Verified fields are never silently overwritten.
4. **Idempotent Identity**: Source documents are keyed by `(company_id, drive_file_id)`. Renaming or moving files in Drive preserves identity with zero duplicates.

---

## 2. Synchronization Mechanisms

### A. Incremental Changes API (Primary Engine)
- Utilizes the Google Drive API v3 `changes.list` and `changes.getStartPageToken`.
- For the initial synchronization, Paguro scans the configured root folder (`Contabilidad`) recursively to index existing files, establishes the baseline `sync_cursor` (the `startPageToken`), and records file checksums/modification timestamps.
- Subsequent synchronizations only request changes that occurred since the saved token:
  ```typescript
  const changes = await drive.changes.list({
    pageToken: integration.sync_cursor,
    spaces: 'drive',
    fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, md5Checksum, parents, trashed))',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  ```
- Dramatically reduces API quota consumption and eliminates repetitive full-tree scanning.

### B. Production Scheduling (Fallback & Auto-Sync)
- **Vercel Cron**: Configured in [`vercel.json`](file:///c:/Users/user/Downloads/ESTRUCTURA%20SISTEMA%20FINANCIERO/Paguro-Finance/vercel.json) to trigger [`/api/cron/drive-sync`](file:///c:/Users/user/Downloads/ESTRUCTURA%20SISTEMA%20FINANCIERO/Paguro-Finance/app/api/cron/drive-sync/route.ts) every 15 minutes (`*/15 * * * *`).
- **Security**: The cron route is guarded by `Authorization: Bearer ${CRON_SECRET}`.
- **Supabase pg_cron / Edge Functions**: Can invoke the same endpoint or execute background sync tasks using Postgres HTTP extensions.
- **Push Notification Channels (Webhooks)**: Google Drive push notifications can be registered via `drive.changes.watch`, which post change signals to [`/api/webhooks/google-drive`](file:///c:/Users/user/Downloads/ESTRUCTURA%20SISTEMA%20FINANCIERO/Paguro-Finance/app/api/webhooks/google-drive/route.ts).

### C. Local Development & Instant Manual Execution
- **Manual Trigger**: The "Ejecutar Sincronización" button in `/integrations` triggers instant synchronization on demand.
- **Local Dev Simulation**: A dedicated test simulation runner (`Simular Cambios Drive`) executes incremental change test-cases locally without external network or OAuth dependencies.

---

## 3. Data Provenance & Precedence Hierarchy

Paguro Finance enforces a strict provenance hierarchy:

$$\text{USER\_VERIFIED} > \text{MANUAL\_ENTRY} > \text{VERIFIED\_INTEGRATION} > \text{AI\_EXTRACTED} > \text{RAW\_DRIVE\_DATA}$$

| Level | Identifier | Description | Overwrite Rules |
|---|---|---|---|
| **1 (Highest)** | `USER_VERIFIED` | Field confirmed or corrected by an authorized user in Paguro Finance. | **Never overwritten** by background sync. |
| **2** | `MANUAL_ENTRY` | Financial movement created manually by user without Drive source. | **Never overwritten** by background sync. |
| **3** | `VERIFIED_INTEGRATION` | Data confirmed via formal bank/fiscal feed. | Drive extraction does not overwrite. |
| **4** | `AI_EXTRACTED` | Extracted by heuristic regex/LLM classifier from Drive metadata. | Updated only if user has not verified the field. |
| **5 (Lowest)** | `RAW_DRIVE_DATA` | File system metadata (filename, mime type, folder, modified time). | Automatically updated on file changes. |

### Protected Fields
When a user reviews and saves changes on a document or movement, the edited field names are recorded in `documents.user_verified_fields` (e.g. `["amount", "document_type", "counterparty", "tax_type"]`) along with `verified_at` and `verified_by`.

---

## 4. Lifecycle Event Handling

### Event 1: New Accounting File
1. Detected by Changes API or recursive scan.
2. Inserted into `documents` with `company_id`, `drive_file_id`, `source_status = 'ACTIVE'`, and `provenance = 'RAW_DRIVE_DATA'`.
3. Heuristic engine classifies document type, extracts period, amounts, and tax mapping.
4. Auto-generates matching `financial_movements` record (source: `'GOOGLE_DRIVE'`).
5. Appears immediately in `/documents` and `/movements`.

### Event 2: File Modified in Drive
1. `modifiedTime` or `md5Checksum` differs from stored record.
2. Technical metadata (`drive_modified_time`, `drive_md5_checksum`, `last_synced_at`) is updated.
3. **If document has verified fields**:
   - Verified fields remain unchanged.
   - A conflict record is created (`documents.source_status = 'CONFLICT'`, conflict type: `'SOURCE_CHANGED_AFTER_VERIFICATION'`).
   - Surfaced in `/dashboard` Review Queue and `/documents` conflict modal for human review.
4. **If document is unverified**:
   - Re-extracts heuristic values and updates matching `financial_movements`.

### Event 3: File Renamed or Moved in Drive
1. Looked up by `company_id + drive_file_id`.
2. Existing record is updated in place with new `filename` and `drive_folder_id`.
3. **Zero duplicates** are created.

### Event 4: File Deleted or Trashed in Drive
1. Drive sends `removed: true` or `trashed: true`.
2. Document record is updated: `source_status = 'SOURCE_MISSING'`.
3. Financial movements, tax associations, and audit trail are **100% preserved**.
4. Clearly badged as `Drive Source Missing` in the UI to prevent ghost discrepancies.

---

## 5. Security & Isolation

- **Token Safety**: Google Drive OAuth `access_token`, `refresh_token`, and client secrets are stored encrypted in the `integrations` table and accessed exclusively by server-side actions and API routes. No client component receives access tokens.
- **Multi-Tenant RLS**: Supabase Row-Level Security policies restrict all database operations to the active `company_id`.
- **Fault Tolerance**: If Google OAuth tokens expire or are revoked, the integration is marked `NEEDS_ATTENTION` without failing other operations or corrupting existing ledger data.
