# Paguro Finance - System Architecture Specification

## 1. System Overview

**Paguro Finance** is a centralized internal financial management system built for **Paguro Corp** and its operating business units (Paguro Corp, Pagureo, Pagurai, and future legal or operational entities).

The primary purpose of Paguro Finance is to replace fragmented spreadsheets and disconnected manual files with a single, immutable, and traceable operational source of truth for:
- Sales Invoices and Accounts Receivable (CxC)
- Purchases/Expenses and Accounts Payable (CxP)
- Collections, Disbursements, and Partial Payment Allocations
- Operational Value Added Tax (IVA) calculation and Period Management
- Product Catalog, Ledger-Based Inventory Movements, and Stock Valuation
- Multi-Entity Master Data (Customers, Suppliers, Tax Rates)
- Secure Financial Document Storage
- Executive Financial Dashboards and Operational Reporting
- Comprehensive, Immutable Audit Logging

> **Compliance Boundary**: Paguro Finance is an operational financial system and management ledger. It is **not** a certified double-entry accounting software or tax filing agent. All tax periodicities, rates, and values provide operational visibility to prepare accounting records and support tax advisors.

---

## 2. Architectural Layers

The system follows a four-tier architecture emphasizing security-in-depth, data integrity, and strict multi-company tenancy:

```
┌────────────────────────────────────────────────────────┐
│               PRESENTATION LAYER (UI)                  │
│       Next.js 14+ (React, Strict TypeScript)           │
│  - Executive Financial SaaS Dashboard                  │
│  - Responsive Navigation & Real-Time KPI Cards         │
│  - Multi-Company Context Switcher                      │
│  - Dynamic Forms with Live Client-Side Math Feedback   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│              APPLICATION & API LAYER                   │
│      Next.js Server Actions & Route Handlers           │
│  - Server-Side Schema Validation & Type Safety         │
│  - Financial Invariant Checks (Zero Balance Checks)    │
│  - Payment Allocation Engine & Integrity Guards        │
│  - Role-Based Access Control (RBAC) Verification       │
│  - Audit Event Dispatcher                              │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                 DATA & SECURITY LAYER                  │
│             Supabase PostgreSQL 15+                    │
│  - Normalized Relational Tables with Foreign Keys      │
│  - Row Level Security (RLS) on all Tenant Tables       │
│  - Authoritative Balance & Total Triggers              │
│  - Immutable Inventory Ledger & Period Freeze Triggers │
│  - Immutable Audit Log Table (Append-Only)             │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│             IDENTITY & STORAGE SERVICES                │
│       Supabase Auth & Supabase Storage                 │
│  - JWT-Based Authentication & Session Cookies          │
│  - Private Storage Bucket (`financial-documents`)      │
│  - Time-Limited Signed URL Access Authorization        │
└────────────────────────────────────────────────────────┘
```

---

## 3. Layer Responsibilities

### 3.1 Frontend Responsibilities (Next.js / React)
- Render executive-grade financial dashboards, responsive data tables with pagination, and modal dialogs.
- Provide live preview calculation during document drafting (immediate subtotal, IVA, and line totals) to ensure responsive UX.
- Guard routes based on authenticated session and role permissions.
- Maintain active `company_id` selection stored in secure session cookie and synchronize all visual lists to the active company.

### 3.2 Backend / Application Layer Responsibilities
- **Authoritative Calculations**: Never trust client-provided monetary totals or balances. Recalculate all totals server-side using validated decimal precision.
- **Cross-Company Isolation**: Verify on every write and read that the target entity `company_id` matches the user's active, authorized company membership.
- **Payment Allocation Engine**: Ensure that payment allocations do not exceed either the payment amount or the outstanding balance of the associated invoices/expenses.
- **Closed-Period Guards**: Reject modifications to financial documents whose dates fall within closed or filed tax periods.
- **Audit Logging**: Dispatch audit log records capturing `user_id`, `company_id`, `action`, `entity_type`, `entity_id`, and before/after state diffs.

### 3.3 Database Responsibilities (Supabase PostgreSQL)
- Enforce relational constraints (`ON DELETE RESTRICT` on historical financial entities).
- Execute authoritative triggers to synchronize `paid_total`, `balance_due`, and document statuses upon payment allocation.
- Enforce database-level **Row Level Security (RLS)** ensuring users only query rows for companies they have active membership in.
- Prevent destructive deletion (`DELETE`) on issued invoices, finalized expenses, closed tax periods, and audit logs.

---

## 4. Multi-Company Tenancy Model

The multi-company architecture is built natively into the database model:

1. **Root Entity (`companies`)**: Represents each distinct legal or operating entity (Paguro Corp, Pagureo, Pagurai, etc.).
2. **Membership (`company_users`)**: Many-to-many relationship linking `profiles.id` (Supabase `auth.users`) to `companies.id`, with a specific operational role (`SUPER_ADMIN`, `ADMIN`, `FINANCE`, `OPERATIONS`, `VIEWER`) and membership status (`active`, `invited`, `suspended`).
3. **Tenant Scoping (`company_id`)**: Every operational table (`sales_invoices`, `purchase_documents`, `customers`, `suppliers`, `products`, `inventory_movements`, `tax_periods`, `payments`, `documents`, `audit_logs`) has a non-nullable foreign key referencing `companies(id)`.
4. **Cross-Tenant Prevention**: Foreign key references across entities (such as invoice to customer) strictly require that both entities share the identical `company_id`.

---

## 5. Storage Architecture

All binary attachments (invoices PDFs, receipts, supplier invoices, tax declarations) are stored securely in Supabase Storage:
- **Bucket**: `financial-documents` configured as **Private** (public access disabled).
- **Object Path Hierarchy**: `{company_id}/{entity_type}/{entity_id}/{timestamp}_{filename}`.
- **Access Control**: Storage RLS policies verify company membership. Downloads and previews are served exclusively through short-lived signed URLs generated server-side.

---

## 6. Future Integration Strategy

Paguro Finance is architecturally decoupled to allow seamless plug-and-play integrations in future phases:
- **DIAN Electronic Invoicing**: Sales invoices support UUID and metadata fields (`dian_cufe`, `dian_qr`, `dian_status`, `dian_xml_path`).
- **Shopify & Ecommerce**: Products support `shopify_product_id` and `shopify_variant_id`. Sales invoice items support external reference tracking.
- **Banks & Payment Gateways**: The `payments` table supports `payment_method`, `external_transaction_id`, and `reconciliation_status` to easily integrate with bank feeds or gateway APIs (e.g., Addi, Wompi, Stripe).
- **Accounting Platforms**: Structured export endpoints and JSON schemas facilitate automated syncing to external accounting software (e.g., Siigo, Alegra).
