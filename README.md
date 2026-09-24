# Paguro Finance V1 — Financial Intelligence + Tax Operations

**Paguro Finance V1** is an internal, multi-company financial intelligence and tax operations platform engineered specifically for **Paguro Corp S.A.S.** and its operating units.

It provides a single, immutable, and traceable source of truth for:
- Normalized Financial Movements Ledger (Inflows, Outflows, Currency Conversion to COP)
- Anti-Duplicate Transaction Detection Engine
- Google Drive Document Ingestion Pipeline & AI Classification
- Human Review Queue for low-confidence (<85%) document extractions
- Multi-Document Economic Linking (e.g. Invoice + Packing List + Bill of Lading + SWIFT)
- Bank Account Management & Intelligent Reconciliation
- Payment Gateway Event Normalization (Stripe, Wompi, PayPal, etc.)
- Colombian Tax Operations Engine (IVA 19% generado vs descontable, Retefuente, ICA)
- Tax Obligations Compliance Calendar (`PREPARED` → `FILED` → `PAID`)
- Read-Only Asesor IA Financial Advisor with 10 deterministic tools and calculation traceability
- Multi-Tenant Row-Level Security (RLS) and Immutable Cryptographic Audit Logging

---

## 1. Visual Identity & Brand System

Paguro Finance strictly adheres to the official Paguro brand identity:
- **Primary Palette:**
  - **Paguro Blue (`#0098FF`):** Primary actions, active navigation states, primary financial metrics.
  - **Paguro Pink (`#E72175`):** High-impact highlights, alert badges, urgent compliance states.
  - **Paguro Navy (`#1E293E`):** Background base, sidebar, cards, elevated overlays.
  - **White (`#FFFFFF`):** High-contrast typography and clean backgrounds.
- **Typography:**
  - Headings: `Montserrat` (700 / 800)
  - UI / Body: `Inter` (400 / 500 / 600)
  - Numeric Data: `JetBrains Mono` (tabular numbers)
- **Official Assets:** Stored and served from [`public/brand/`](file:///c:/Users/user/Downloads/ESTRUCTURA%20SISTEMA%20FINANCIERO/Paguro-Finance/public/brand) (`paguro-logo-primary.webp`, `paguro-icon.png`, `paguro-icon.svg`, `favicon-32x32.png`, etc.).

---

## 2. Primary V1 Navigation Routes

The production application is focused around 8 core modules:

1. **`/dashboard` — Executive Financial Dashboard:** 9 real-time KPI cards, 5 period filters, Central Review Queue, and 6 financial summary sections.
2. **`/movements` — Normalized Financial Movements Ledger:** Full multi-criteria filtering, duplicate candidate warning, and comprehensive detail drawer.
3. **`/documents` — Document Intelligence Pipeline:** Google Drive discovery, AI extraction status tabs, Human Review Queue, and movement linker.
4. **`/taxes` — Colombian Tax Operations:** IVA 19% generado vs descontable, Retefuente, ICA municipal rates, and statutory DIAN disclaimers.
5. **`/obligations` — Tax Obligations Calendar:** Compliance tracker with state machine (`UPCOMING` → `PREPARED` → `FILED` → `PAID`) and evidence document attachment.
6. **`/ai-advisor` — Asesor Financiero IA:** 10 read-only deterministic tools querying live PostgreSQL data across 8 defined time windows with full calculation traceability.
7. **`/integrations` — Integrations Registry:** Provider registry (Google Drive, DIAN, Bancolombia, Stripe) with idempotent sync logging (`sync_logs`).
8. **`/settings` — Configuration Hub:** Corporate details, Movement Category management (create, edit, soft-deactivate), Company Tax Profile editor, Users RBAC, and Audit Log.

---

## 3. Technology Stack

- **Framework:** Next.js 14.2+ (App Router), React 18, TypeScript (Strict Mode)
- **Styling:** Vanilla CSS Design Tokens (`app/globals.css`), CSS Variables, Tabular Numeric Formatting
- **Database:** PostgreSQL 17 on Supabase with Multi-Tenant Row-Level Security (RLS)
- **Storage:** Supabase Storage (`financial-documents` private bucket with signed URLs)
- **Testing:** Vitest automated test suite (214/214 tests passing across 15 test suites)

---

## 4. Local Development Setup

### 1. Prerequisites
- Node.js `>= 18.17.0` (Node 20 LTS recommended)
- npm `>= 9.0.0`

### 2. Installation
```bash
git clone <repository-url>
cd Paguro-Finance
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the required Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://suuwgzrilxoswvrqigbp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Testing & Verification

```bash
# Run Vitest test suite (214 tests)
npm test

# Run strict TypeScript typecheck
npx tsc --noEmit

# Run Next.js ESLint
npm run lint

# Compile production build
npm run build
```

---

## 6. Pilot Validation Workflow

Before deploying to live operations, execute the 13-stage pilot testing procedure documented in:
[`docs/real-data-pilot.md`](file:///c:/Users/user/Downloads/ESTRUCTURA%20SISTEMA%20FINANCIERO/Paguro-Finance/docs/real-data-pilot.md)

---

## 7. Compliance & Legal Disclaimer

> **Statutory Disclaimer:** Paguro Finance V1 provides internal managerial financial intelligence and tax estimation. It is not an official tax filing service, does not transmit electronic XML documents directly to the DIAN, and does not replace the professional judgment of a certified Public Accountant.
