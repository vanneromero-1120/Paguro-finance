# Paguro Finance

**Paguro Finance** is a centralized, internal, multi-company financial management system built for **Paguro Corp** and its operating business units (Paguro Corp, Pagureo, Pagurai, and future units).

It replaces fragmented spreadsheets and disconnected manual files with a single, immutable, and traceable operational source of truth for:
- Sales Invoices and Accounts Receivable (CxC)
- Purchases / Expenses and Accounts Payable (CxP)
- Partial Payments and Multi-Document Allocations
- Operational Value Added Tax (IVA) calculation and Period Management
- Product Catalog and Ledger-Based Inventory Movements
- Centralized Financial Document Repository
- Executive Financial Dashboards and Tabular Reports
- Role-Based Access Control (RBAC) and Row Level Security (RLS)
- Comprehensive, Immutable Audit Logging

> **Compliance Note**: Paguro Finance provides operational financial management. It does not replace certified double-entry accounting software or official DIAN tax filing declarations.

---

## 1. Technology Stack

- **Frontend**: Next.js 14+ (App Router), React 18, TypeScript (Strict Mode)
- **Styling**: Vanilla CSS Design Tokens, Modular CSS Variables, Tabular Financial Typography
- **Backend**: Next.js Server Actions, Route Handlers, Supabase Client (`@supabase/ssr`)
- **Database**: PostgreSQL 15+ hosted on Supabase with Row Level Security (RLS)
- **Storage**: Supabase Storage (`financial-documents` private bucket with signed URLs)
- **Testing**: Vitest automated test suite for financial math, inventory ledgers, and RBAC

---

## 2. Project Structure

```
Paguro-Finance/
├── docs/                      # Technical architecture documentation
│   ├── architecture.md        # System layers, boundaries & tenant model
│   ├── database-schema.md     # Relational schema DDL specifications
│   ├── permissions.md         # RBAC matrix (SUPER_ADMIN, ADMIN, FINANCE, ACCOUNTANT, OPS, VIEWER)
│   ├── financial-rules.md     # Exact rounding, invariants, voiding rules
│   ├── business-rules.md      # Movement deltas, terms, sequences
│   ├── security.md            # RLS policies, token handling, storage
│   ├── implementation-plan.md # Phased implementation roadmap & status
│   ├── decisions.md           # Architecture Decision Records (ADRs 001-010)
│   └── testing-plan.md        # Verification plan & test coverage
├── database/
│   ├── migrations/            # Versioned PostgreSQL DDL & Triggers
│   │   ├── 00001_initial_schema.sql
│   │   ├── 00002_functions_and_triggers.sql
│   │   ├── 00003_row_level_security.sql
│   │   └── 00004_seed_demo_data.sql
│   ├── policies/              # RLS catalog
│   └── seed/                  # Modular demo seed scripts
├── app/                       # Next.js 14+ App Router
│   ├── layout.tsx             # Root layout with AppShell
│   ├── page.tsx               # Redirect to dashboard
│   ├── auth/callback/         # Supabase token exchange callback
│   ├── login/                 # Authentication & demo presets
│   ├── forgot-password/       # Password recovery request flow
│   ├── reset-password/        # Secure credential update flow
│   ├── unauthorized/          # 403 Security boundary screen
│   ├── dashboard/             # Executive KPI dashboard
│   ├── sales/                 # Invoices, Customers, Collections
│   ├── purchases/             # Expenses, Suppliers, Disbursements
│   ├── inventory/             # Products catalog & Movement ledger
│   ├── taxes/                 # IVA by period & adjustments
│   ├── reports/               # Financial reports & CSV exports
│   ├── documents/             # Storage document explorer
│   └── settings/              # Companies, Users, Audit log
├── middleware.ts              # Root session token refresher & route protection
├── components/                # Reusable UI & Layout components
├── lib/                       # Core enterprise engines & utilities
│   ├── auth/                  # Permissions, Server Auth, & Actions
│   ├── finance/               # Financial math & rounding engine
│   ├── storage/               # Private document storage (signed URLs)
│   ├── supabase/              # Browser, server, admin, & middleware clients
│   └── utils/                 # Formatting & currency helpers
├── types/                     # Database and domain TypeScript types
└── tests/                     # Automated Vitest suites (41 tests)
```

---

## 3. Local Setup & Quickstart

### Prerequisites
- Node.js 18+ (Tested on Node.js v24.14.0)
- npm 9+ (Tested on npm 11.9.0)
- Supabase account (optional for local offline demo)

### Installation
```bash
# Clone the repository
git clone https://github.com/pagurocorp/paguro-finance.git
cd Paguro-Finance

# Install dependencies
npm install
```

### Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase project credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```
*(Note: If no Supabase credentials are provided, Paguro Finance automatically operates using the rich in-memory operational seed store).*

### Database Setup
To deploy the database schema to your Supabase PostgreSQL database, execute the migration files sequentially:
1. `database/migrations/00001_initial_schema.sql` (Tables, constraints, indexes)
2. `database/migrations/00002_functions_and_triggers.sql` (Recalculations, audit triggers, stock checks)
3. `database/migrations/00003_row_level_security.sql` (Multi-tenant RLS policies)
4. `database/migrations/00005_products_cross_company_integrity.sql` (SKU uniqueness & FK integrity)
5. `database/migrations/00006_sales_invoice_numbering.sql` (Sequential invoice sequence)
6. `database/migrations/00007_tax_periods_notes_created_by.sql` (Tax period audit metadata)
7. `database/migrations/00008_documents_and_storage_policies.sql` (Private storage bucket & RLS)
8. `database/migrations/00009_company_contact_fields.sql` (Company profile contact fields)

*(Note: `00004_seed_demo_data.sql` is for local offline development only and is NOT applied in production).*

---

## 4. Development, Quality Assurance & Production Verification

```bash
# Run automated test suites (14 suites, 196 tests passing)
npm test

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Build for production
npm run build

# Verify against live Supabase production gate
node --env-file=.env.local scripts/verify-full-production.mjs
```

---

## 5. Security & Row Level Security (RLS)

- Every financial and operational entity includes a mandatory `company_id`.
- Access is strictly governed by active user membership in `company_users` and evaluated via `has_company_access()`.
- Cross-company data leaks are prevented at the database kernel level through RLS.
- Financial audit logs in `audit_logs` are strictly append-only and cryptographically protected against tampering.
- Role management enforces anti-self-escalation and role hierarchy rules.
- Complete specification available in [Production Readiness Documentation](docs/production-readiness.md).

---

## 6. License & Ownership
Copyright © 2026 Paguro Corp. All rights reserved. Internal operational software.

