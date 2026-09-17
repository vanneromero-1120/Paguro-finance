# Paguro Finance - Phased Implementation Plan

## Overview & Execution Roadmap

The implementation of **Paguro Finance** is structured into 21 systematic phases designed to progress from foundational architecture to production readiness.

---

## Phase Breakdown

- **PHASE 0: Blueprint Analysis**: Extraction and complete understanding of functional and non-functional requirements from the primary source of truth.
- **PHASE 1: Technical Documentation**: Generation of complete technical specs (`architecture.md`, `database-schema.md`, `permissions.md`, `financial-rules.md`, `business-rules.md`, `security.md`, `decisions.md`, `testing-plan.md`).
- **PHASE 2: Project Initialization**: Next.js 14+ App Router, TypeScript strict mode, CSS design tokens, and project directory structure.
- **PHASE 3: Database Schema**: PostgreSQL DDL creation with typed columns, constraints, foreign keys, and indexes.
- **PHASE 4: Supabase Migrations & Triggers**: SQL migrations for schema, total/balance calculation triggers, and closed-period enforcement triggers.
- **PHASE 5: Authentication & Multi-Company Context**: Supabase Auth integration, session management, and active company context state.
- **PHASE 6: Roles & Row Level Security (RLS)**: Implementation of RLS policies across all tenant tables and role verification helpers.
- **PHASE 7: Application Shell & UI System**: Executive financial dashboard layout, responsive sidebar, company switcher, and reusable UI components.
- **PHASE 8: Customers & Suppliers**: Master data CRUD with tax ID validation, terms, and balance indicators.
- **PHASE 9: Products & Catalog**: SKU catalog, tax rate binding, and low stock threshold alerts.
- **PHASE 10: Sales Invoices**: Invoice multi-line drafting, live preview, issuance, status tracking, and PDF document linking.
- **PHASE 11: Purchases & Expenses**: Supplier expense tracking, deductible VAT assignment, and payment terms.
- **PHASE 12: Payments & Allocations**: Inbound collections and outbound disbursements with multi-document allocation and automatic balance sync.
- **PHASE 13: Inventory Movements**: Double-entry style movement ledger, delta tracking, and derived stock calculation.
- **PHASE 14: Value Added Tax (IVA)**: Operational period summary, generated vs deductible VAT, authorized adjustments, and period close/reopen.
- **PHASE 15: Financial Dashboard**: Executive KPIs (Revenue, Expenses, CxC, CxP, VAT, Inventory Valuation, Overdue Alerts).
- **PHASE 16: Financial Reports**: Tabular reports with filtering by company, date range, and CSV export capabilities.
- **PHASE 17: Document Management**: Metadata tracking and secure signed-URL downloads via Supabase Storage.
- **PHASE 18: Audit System**: Comprehensive audit logging capturing entity before/after JSON states.
- **PHASE 19: Testing & Verification**: Automated unit tests for math, payment invariants, and tenant isolation.
- **PHASE 20: Security Review & Hardening**: Verification of RLS denial by default, absence of client secrets, and error handling.
- **PHASE 21: Production Readiness**: Seed data generation, environment setup guide, and deployment readiness on Vercel.
