# Paguro Finance V1 — Production Readiness Specification & Deployment Blueprint

**Document Version:** 1.0.0  
**Target Environment:** Production (Vercel + Supabase Enterprise Cloud)  
**System Status:** READY FOR PRODUCTION  

---

## 1. Architecture Status

Paguro Finance V1 is built as a multi-company, multi-tenant financial operations and treasury management platform. All runtime services are powered exclusively by authoritative server-side execution, live Supabase PostgreSQL, Row-Level Security (RLS), and append-only cryptographic audit logging.

### Architectural Invariants
1. **Multi-Company Data Isolation:** Enforced at the database engine level via PostgreSQL Row-Level Security (RLS) policies on every sensitive table (`companies`, `customers`, `suppliers`, `products`, `inventory_movements`, `sales_invoices`, `sales_invoice_items`, `payments`, `payment_allocations`, `purchase_documents`, `purchase_document_items`, `tax_periods`, `documents`, `audit_logs`).
2. **Strict RBAC Model:** Dynamic permission evaluation (`SUPER_ADMIN`, `ADMIN`, `FINANCE`, `ACCOUNTANT`, `OPERATIONS`, `VIEWER`) based on active company memberships in `company_users`.
3. **Anti-Self-Escalation & Role Hierarchy:** Users cannot modify their own roles or elevate privileges beyond their authorization. Only `SUPER_ADMIN` can assign `SUPER_ADMIN`.
4. **Append-Only Immutable Audit Trail:** Financial mutations and role transitions automatically insert records into `audit_logs`. Database triggers and absence of UPDATE/DELETE RLS policies prevent tampering or deletion.
5. **Zero Mock Dependencies:** Zero reliance on `mock-store.ts` or demo presets in production runtime.

---

## 2. Deployment Requirements

### Hosting Target
- **Web Application & API Server Actions:** Vercel (Next.js 14 App Router)
- **Database, Auth & Storage:** Supabase Cloud (PostgreSQL 15+)

### Prerequisites
- Node.js runtime: `>= 18.17.0` (Recommended: Node 20 LTS or Node 24)
- Supabase project with database extensions `pgcrypto` and `uuid-ossp`
- Private Supabase Storage bucket: `financial-documents` (private, non-public)
- HTTPS mandatory on all production domains

---

## 3. Environment Variables

Documented in `.env.example`. Required for Vercel Project Settings:

| Variable Name | Environment | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Live Supabase project URL (`https://suuwgzrilxoswvrqigbp.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Supabase public anonymous API key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Production (Secret) | Server-only administrative key (used only for migrations/workers, never in browser) |
| `NEXT_PUBLIC_APP_NAME` | Production, Preview | `Paguro Finance` |
| `NEXT_PUBLIC_APP_URL` | Production | Canonical public URL (e.g. `https://finance.pagurocorp.com`) |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | Production | Default currency code (`COP`) |
| `NEXT_PUBLIC_DEFAULT_TIMEZONE` | Production | Default timezone (`America/Bogota`) |
| `SUPABASE_STORAGE_BUCKET_FINANCIAL_DOCS` | Production | `financial-documents` |

> [!CAUTION]
> Never prepend `NEXT_PUBLIC_` to `SUPABASE_SERVICE_ROLE_KEY`. The service role key bypasses RLS and must strictly remain server-only.

---

## 4. Supabase Project Requirements & Configuration

1. **Applied Database Migrations:**
   - `00001_initial_schema.sql` (Tables, constraints, indexes)
   - `00002_functions_and_triggers.sql` (Automated recalculations, balance updates, stock checks, audit triggers)
   - `00003_row_level_security.sql` (Enterprise multi-company RLS)
   - `00005_products_cross_company_integrity.sql` (SKU uniqueness and cross-company foreign-key guard)
   - `00006_sales_invoice_numbering.sql` (Automated sequential numbering)
   - `00007_tax_periods_notes_created_by.sql` (Tax period metadata)
   - `00008_documents_and_storage_policies.sql` (Private storage bucket and object isolation)
   - `00009_company_contact_fields.sql` (Company profile contact and address fields)

2. **Storage Policies:**
   - Bucket `financial-documents` set to `public = FALSE`.
   - Access strictly governed by RLS storage policies (`pol_storage_financial_docs_select`, `pol_storage_financial_docs_insert`, etc.).
   - Downloads generated using short-lived signed URLs (5-minute TTL).

3. **Authentication Settings (Supabase Auth Dashboard):**
   - **Site URL:** `https://finance.pagurocorp.com` (or Vercel production domain)
   - **Redirect URLs:**
     - `https://finance.pagurocorp.com/auth/callback`
     - `https://finance.pagurocorp.com/reset-password`
     - `http://localhost:3000/auth/callback` (for local development)
   - Email provider enabled with template configuration.

---

## 5. Backup & Disaster Recovery Strategy

Paguro Finance handles mission-critical accounting and treasury operations. The operational backup strategy includes:

1. **Supabase Automated Daily Backups:**
   - Point-in-Time Recovery (PITR) recommended for production enterprise instances (enables restoration to any second in the past 7 days).
   - Daily automated logical dumps retained according to Supabase retention policies.
2. **Pre-Migration Snapshots:**
   - Before applying any schema migration in production, run a manual pg_dump:
     ```bash
     pg_dump -h db.[project-ref].supabase.co -U postgres -d postgres -F c -b -v -f paguro_backup_$(date +%Y%m%d_%H%M%S).dump
     ```
3. **Repository Version Control:**
   - All schema changes, functions, triggers, and storage policies must reside under `database/migrations/`.
   - Continuous deployment strictly tied to Git tags/commits.

---

## 6. Operational Checklist

Before declaring Go-Live:
- [x] All 14 test suites passing (`196/196` unit tests in Vitest).
- [x] TypeScript compilation passes with zero errors (`npx tsc --noEmit`).
- [x] ESLint passes with zero warnings (`npm run lint`).
- [x] Production build passes cleanly (`npm run build`).
- [x] Live Supabase security audit passes (zero anonymous access, RLS active).
- [x] Anti-self-escalation verified on live database.
- [x] Audit logs verified append-only and tamper-proof.
- [x] Production runtime mock dependencies: **0**.
- [x] Demo switcher credentials removed from `/login`.
- [x] Private storage policies verified (signed URLs only).

---

## 7. Rollback Strategy

In the event of a production regression or incident:

1. **Application Rollback (Vercel):**
   - In the Vercel Dashboard, select the previous stable deployment and click **Instant Rollback**.
   - Traffic shifts within seconds without code rebuilds.
2. **Database Schema Rollback:**
   - Schema migrations are additive and backwards-compatible.
   - For irreversible DDL changes, restore to the pre-migration PITR snapshot via the Supabase Dashboard.
3. **Storage Rollback:**
   - Files in Supabase Storage are immutable by storage path (timestamp prefixed). Older document versions are preserved.

---

## 8. Known Limitations (V1 Scope)

Paguro Finance V1 is designed as a financial operations, treasury, invoicing, and tax tracking platform. The following features are intentionally reserved for future versions:

1. **DIAN Electronic Invoicing:** V1 generates internal legal sales invoices, consecutive numbering, and PDF exports. Direct XML web service transmission to DIAN (facturación electrónica previa) is slated for V2.
2. **Official DIAN Tax Filing:** V1 calculates generated and deductible IVA, retention balances, and period closures. Direct automated filing with DIAN Muisca is slated for V2.
3. **Full Double-Entry Ledger:** V1 operates on transactional accounting and sub-ledgers (A/R, A/P, Cash Flow, Tax Balances). Full multi-account general ledger double-entry journal is slated for V2.
4. **Automated Bank Feeds:** Payments are recorded manually or via CSV batch imports. Open Banking API feeds (Bancolombia, Davivienda) are planned for V2.
5. **Third-Party Sync:** Integrations with Shopify, Addi, and Meta Ads are scheduled for subsequent iterations.

---

## 9. Future Integrations Roadmap

- **V1.1:** Enhanced Excel / CSV historical migration tool with schema mapper.
- **V1.2:** Automated email delivery of invoices with signed download attachments.
- **V2.0:** DIAN Web Service integration with electronic signing certificate (facturación electrónica).
- **V2.1:** Banking API direct reconciliation (Bancolombia Transferencias & PSE).
- **V2.2:** E-commerce multi-store sync (Shopify, WooCommerce, MercadoLibre).
