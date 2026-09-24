# Paguro Finance V1 — Production Readiness & Deployment Blueprint

**Document Version:** 1.1.0  
**Target Environment:** Production (Vercel + Supabase Enterprise Cloud)  
**System Status:** READY FOR REAL DATA PILOT  
**Release:** Version 1.0 (Financial Intelligence + Tax Operations System)  
**Supabase Database:** `suuwgzrilxoswvrqigbp` (PostgreSQL 17, Multi-tenant RLS active)

---

## 1. V1 Architecture & Capabilities

Paguro Finance V1 is a **Financial Intelligence + Tax Operations System** designed for Paguro Corp. It normalizes all corporate financial events, automates accounting document tracking, detects duplicate movements, supports bank reconciliation, calculates estimated Colombian tax positions (IVA, Retefuente, ICA), and provides an interactive AI Financial Advisor grounded strictly in live database calculations.

### Core Architectural Invariants:
1. **Authoritative Ledger (`financial_movements`):** All financial inflows and outflows normalize into this single table regardless of origin (Bank, Document, Payment Gateway, or Manual Entry).
2. **Multi-Document Economic Operations:** A single economic operation (e.g. import shipment) can link multiple supporting documents (Commercial Invoice, Packing List, Bill of Lading, SWIFT) without duplicating the underlying financial movement.
3. **Multi-Company Data Isolation:** Enforced at the PostgreSQL engine level via Row-Level Security (RLS) policies on all tables.
4. **Append-Only Immutable Audit Trail:** Sensitive mutations (movements, categories, tax profiles, unmatching, review statuses) write to `audit_logs`.
5. **Zero Mock Dependencies:** 100% of production runtime queries live Supabase tables. Non-configured integrations explicitly surface as `NOT CONFIGURED`.

---

## 2. Completed V1 Modules & Route Manifest

| Route | Module Name | Status | Functionality |
|---|---|:---:|---|
| `/` | Root / Redirect | **ACTIVE** | Authenticated routing to `/dashboard` or `/login` |
| `/login` | Portal de Acceso | **ACTIVE** | Paguro official identity, secure password login |
| `/dashboard` | Executive Dashboard | **ACTIVE** | 9 KPI cards, 5 period filters, Central Review Queue, 6 summary sections |
| `/movements` | Movimientos Financieros | **ACTIVE** | Authoritative normalized ledger, multi-filter drawer, duplicate prevention |
| `/documents` | Documentos Contables | **ACTIVE** | Google Drive pipeline, AI extraction, human review queue, movement linker |
| `/taxes` | Operaciones Tributarias | **ACTIVE** | IVA 19% generado/descontable, Retefuente, ICA, statutory DIAN disclaimers |
| `/obligations` | Calendario Tributario | **ACTIVE** | Compliance tracker, state machine (`PREPARED` → `FILED` → `PAID`), proofs |
| `/ai-advisor` | Asesor Financiero IA | **ACTIVE** | 10 read-only deterministic tools, 8 time windows, calculation traceability |
| `/integrations` | Hub de Integraciones | **ACTIVE** | Google Drive, DIAN, Bancolombia, Stripe registry with idempotent `sync_logs` |
| `/settings` | Configuración | **ACTIVE** | Company data, Category CRUD, Tax Profile editor, Users RBAC, Audit log |
| `/api/auth/google` | Google OAuth Route | **ACTIVE** | Initiates Google OAuth consent screen for Drive document ingestion |
| `/api/auth/google/callback` | Google OAuth Callback | **ACTIVE** | Exchanges authorization code, saves tokens in database, logs audit trail |

---

## 3. Database & Migration Status

All database changes are represented in version-controlled SQL migrations:
- `00001` through `00009`: Base schema, functions, triggers, invoices, purchases, audit.
- `00010_v1_financial_intelligence_and_tax.sql`:
  - `movement_categories`: Hierarchical category tree with color tokens and soft-deactivation.
  - `bank_accounts`: Bank entity tracking, account types, balances.
  - `financial_movements`: Central normalized ledger with RLS.
  - `bank_transactions`: Bank statement feeds and match state machine.
  - `company_tax_profile`: Tax regime, municipality, ICA configuration.
  - `tax_obligations`: Compliance tracker with proof document attachments.
  - `tax_notifications`: Multi-channel reminder alert triggers.
  - `integration_connections` & `sync_logs`: Idempotent sync engine.
  - `documents` extensions: Google Drive file IDs, AI extraction confidence scores.

---

## 4. Quality & Build Verification Metrics

| Test Suite / Tool | Command | Result | Notes |
|---|---|:---:|---|
| **Vitest Test Suite** | `npm test` | **PASS (214/214)** | 15 test files passed, 0 failures |
| **V1 Intelligence Tests** | `tests/v1-financial-intelligence.test.ts` | **PASS (18/18)** | Covers all 15 acceptance criteria |
| **TypeScript Strict Check** | `npx tsc --noEmit` | **PASS (0 errors)** | 100% strict type safety across all files |
| **Next.js ESLint** | `npm run lint` | **PASS (0 warnings)** | `✔ No ESLint warnings or errors` |
| **Production Build** | `npm run build` | **PASS (33/33)** | All routes compiled and prerendered cleanly |

---

## 5. External Credentials & Setup Instructions

External integrations are designed to remain resilient and explicitly display `NOT CONFIGURED` until client credentials are supplied.

### 1. Google Drive Document Ingestion Setup:
When client credentials become available, configure in `.env.local`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```
**Google Cloud Console Requirements:**
1. Enable **Google Drive API**.
2. Configure OAuth Consent Screen (Internal or External).
3. Add Authorized Redirect URI:
   - Development: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://[your-domain]/api/auth/google/callback`
4. Required Scopes: `https://www.googleapis.com/auth/drive.readonly` and `email`.

### 2. Bank & Payment Providers:
- Bancolombia / Davivienda: Currently marked `REQUIRES PROVIDER`. Manual statement upload and CSV normalization are available immediately.
- Payment Gateways (Stripe, Wompi): Architecture ready. Normalizes charges and fee deductions into `financial_movements`.

---

## 6. Version 1 Limitations

Consistent with the 4-version roadmap (`docs/product-roadmap.md`), V1 intentionally focuses on financial intelligence and tax operations. It does **not** attempt to provide:
1. Official XML transmission or electronic invoice clearance with the DIAN (Reserved for V2).
2. Autonomous tax filing or automated debiting of tax payments (Human review mandatory).
3. Full double-entry debits/credits bookkeeping (Ledger is single-entry normalized).
4. Multi-location physical warehouse inventory dispatching (Reserved for V2).
5. Consolidated financial statements across legal holding entities (Reserved for V3).

---

## 7. Pilot Execution Workflow

Refer to [`docs/real-data-pilot.md`](file:///c:/Users/user/Downloads/ESTRUCTURA%20SISTEMA%20FINANCIERO/Paguro-Finance/docs/real-data-pilot.md) for the complete 13-stage pilot testing protocol.
