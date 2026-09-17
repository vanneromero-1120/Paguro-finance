# Paguro Finance - Architecture Decision Records (ADRs)

This document tracks significant architectural and technical decisions made during the design and implementation of Paguro Finance.

---

## ADR-001: Next.js 14+ App Router with Vanilla CSS / CSS Modules
- **Date**: 2026-09-17
- **Decision**: Build the application frontend using Next.js 14+ with App Router, React 18/19, strict TypeScript, and a custom Vanilla CSS design system (CSS variables and modular styling) rather than external CSS utility frameworks.
- **Reason**: Maximizes styling flexibility, eliminates bulky dependencies, ensures tight control over typography and layout, and delivers a sleek, high-performance financial SaaS experience without build-time overhead.
- **Alternatives Considered**: Tailwind CSS (adds configuration complexity and potential version conflicts), Material UI (too generic and heavyweight).
- **Impact**: Clean, maintainable component stylesheets, fast rendering, and zero CSS runtime bloat.

---

## ADR-002: Multi-Company Tenancy with Explicit `company_id` on All Entities
- **Date**: 2026-09-17
- **Decision**: Every operational entity table contains a non-nullable `company_id UUID REFERENCES companies(id)`. Access is gated via `company_users` and PostgreSQL Row Level Security (RLS).
- **Reason**: Paguro Corp operates multiple distinct business units (Paguro Corp, Pagureo, Pagurai). A single multi-tenant database reduces operational overhead while RLS guarantees bulletproof data isolation.
- **Alternatives Considered**: Database-per-tenant (costly, high maintenance overhead for small/medium business units), schema-per-tenant (complex migration management).
- **Impact**: Single unified codebase and migration pipeline with complete logical isolation enforced at the database kernel level.

---

## ADR-003: Monetary Storage Using `NUMERIC(14, 2)` and Half-Up Rounding
- **Date**: 2026-09-17
- **Decision**: Persist all financial amounts as `NUMERIC(14, 2)` and tax rates as `NUMERIC(5, 4)`. Floating point types are prohibited.
- **Reason**: Floating point math introduces IEEE 754 precision errors (e.g. `0.1 + 0.2 = 0.30000000000000004`), which can cause balancing errors in financial statements.
- **Alternatives Considered**: Integer cents/centavos (less intuitive for reporting with tax rates like 19%), Float/Real (unacceptable financial inaccuracies).
- **Impact**: Guaranteed exact calculations and zero drift in invoices, payments, and balances.

---

## ADR-004: Derived Inventory Stock from Immutable Movement Ledger
- **Date**: 2026-09-17
- **Decision**: The current physical stock of a product is never stored as an independently editable single value. It is strictly derived by summing historical records in `inventory_movements`.
- **Reason**: Manual stock edits erase accountability. An immutable ledger ensures every addition, shipment, return, or scrap event has an author, timestamp, reason, and reference document.
- **Alternatives Considered**: Single editable `stock` column with an audit trigger (prone to desynchronization and difficult to reconcile).
- **Impact**: Complete auditability of inventory with reproducible historical stock at any given date.

---

## ADR-005: Independent Payment Ledger with Document Allocations
- **Date**: 2026-09-17
- **Decision**: Payments are modeled as independent records (`payments`) linked to invoices or expenses via a join entity (`payment_allocations`).
- **Reason**: Supports partial payments, single payments covering multiple invoices, customer advances, and independent payment method tracking.
- **Alternatives Considered**: Storing payment fields directly on the invoice (cannot support multiple payments or partial settlements).
- **Impact**: Flexible accounts receivable (CxC) and accounts payable (CxP) operations.

---

## ADR-006: Operational Tax Periods with Frozen History
- **Date**: 2026-09-17
- **Decision**: Model VAT via configurable `tax_periods` that can be set to `closed`, which triggers database constraints preventing any retro-active creation, alteration, or deletion of invoices and expenses within that date range.
- **Reason**: Prevents silent modifications to periods that have already been reviewed or filed with tax authorities.
- **Alternatives Considered**: Unrestricted historical editing (creates discrepancies with previously prepared tax reports).
- **Impact**: High compliance integrity and trust for accounting stakeholders.
