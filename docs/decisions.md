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

---

## ADR-007: Relational Compatibility Views for Blueprint and Standard Conventions
- **Date**: 2026-09-17
- **Decision**: Provide PostgreSQL relational views `company_members` (aliasing `company_users`), `invoices` (aliasing `sales_invoices`), `invoice_items` (aliasing `sales_invoice_items`), `expenses` (aliasing `purchase_documents`), and `expense_items` (aliasing `purchase_document_items`).
- **Reason**: Harmonizes database naming conventions across both the original blueprint and prompt specifications without duplicating tables or compromising foreign key integrity.
- **Alternatives Considered**: Renaming tables destructively (breaks existing documentation and blueprint traceability).
- **Impact**: Code and third-party integrations can seamlessly query either nomenclature transparently.

---

## ADR-008: Database-Enforced Cross-Tenant Foreign-Key Validation Triggers
- **Date**: 2026-09-17
- **Decision**: Implement PostgreSQL `BEFORE INSERT OR UPDATE` triggers (`validate_cross_company_integrity()`) on `sales_invoices`, `purchase_documents`, `payment_allocations`, and `inventory_movements` that reject any attempt to link a record from Company A with a customer, supplier, product, or document from Company B.
- **Reason**: Standard foreign keys enforce that a customer exists, but cannot inherently enforce that `customer.company_id == invoice.company_id`. Triggers close this multi-tenant vulnerability at the PostgreSQL engine level.
- **Alternatives Considered**: Relying purely on application-level or API checks (vulnerable to direct SQL or compromised API calls).
- **Impact**: Impossible to cross-contaminate corporate identities even if client code is bypassed.

---

## ADR-009: Private Financial Storage Architecture with Cryptographic Signed URLs
- **Date**: 2026-09-17
- **Decision**: Store all financial attachments, tax certificates, and invoices in a private Supabase Storage bucket (`financial-documents`) organized by `{company_id}/{entity_type}/{entity_id}/{filename}`. Direct public URLs are disabled. Access is exclusively granted via short-lived HMAC-signed URLs (default 300 seconds).
- **Reason**: Commercial and fiscal confidentiality requires that documents cannot be enumerated or downloaded without active company authorization.
- **Alternatives Considered**: Public buckets with unguessable UUID names (leaks URLs via browser histories, logs, and indexing).
- **Impact**: Strict enterprise privacy, auditable access, and compliance with Colombian data protection regulations.

---

## ADR-010: Six-Tier Granular Role-Based Access Control (RBAC)
- **Date**: 2026-09-17
- **Decision**: Standardize on six distinct user roles: `SUPER_ADMIN`, `ADMIN`, `FINANCE`, `ACCOUNTANT`, `OPERATIONS`, and `VIEWER`. Specifically, `ACCOUNTANT` possesses rights to view transactions, manage VAT/taxes, perform period closes, and export financial statements, but is prohibited from creating sales invoices, expenses, or administering company users.
- **Reason**: Segregation of duties (SoD) is essential for corporate governance; accountants audit and certify taxes but should not generate operational invoices or modify user privileges.
- **Alternatives Considered**: Merging accounting into the `FINANCE` role (violates separation between operational spending and external fiscal audit).
- **Impact**: Clear, enforceable authorization boundary matching real-world corporate workflows.

---

## ADR-011: Relational Views Security Invoker Enforcement (PostgreSQL 15+)
- **Date**: 2026-09-17
- **Decision**: Define all PostgreSQL relational views (`company_members`, `invoices`, `invoice_items`, `expenses`, `expense_items`) with `WITH (security_invoker = true)`.
- **Reason**: By default in PostgreSQL, views execute with the privileges of the view owner (postgres), which silently circumvents Row Level Security (RLS) on underlying tables. Enforcing `security_invoker = true` guarantees that the querying user's active RLS policies are authoritatively evaluated.
- **Alternatives Considered**: Omit views and require callers to query base tables only (loses compatibility with established blueprint naming conventions).
- **Impact**: Eliminates privilege escalation risk and ensures tenant data isolation across all view queries.

---

## ADR-012: Server-Side Authoritative Line-Item Calculations and Tamper-Proof Audit Triggers
- **Date**: 2026-09-17
- **Decision**: Implement `BEFORE INSERT OR UPDATE` triggers on `sales_invoice_items` and `purchase_document_items` to authoritatively compute line totals and taxes from base inputs (`quantity`, `unit_price`, `discount_amount`, `tax_rate`), and deploy a strict `BEFORE UPDATE OR DELETE` exception trigger on `audit_logs`.
- **Reason**: Financial calculations must never rely on insecure or untrusted client-side mathematics. Audit logs must be structurally append-only and immune to modification or deletion even by privileged roles.
- **Alternatives Considered**: Calculating line totals purely in application JavaScript (vulnerable to API tampering and floating-point drift).
- **Impact**: Complete server-side fiscal mathematical integrity and an immutable, legally defensible audit trail.

---

## ADR-013: Hardened SECURITY DEFINER Search Path for Multi-Tenant Auth Functions
- **Date**: 2026-09-17
- **Decision**: Explicitly configure `SET search_path = public, auth` on all `SECURITY DEFINER` helper functions (`current_user_has_company_role`, `current_user_is_super_admin`).
- **Reason**: Prevents search-path hijacking vulnerabilities where a malicious user could shadow schemas or functions, and satisfies Supabase Security Advisor and PostgreSQL hardening standards.
- **Alternatives Considered**: Using default dynamic search path (flagged by security linters and vulnerable to search path spoofing).
- **Impact**: Robust cryptographic isolation and automated compliance with Supabase Security Advisories.

---

## ADR-014: Non-Recursive Row Level Security Policy Expressions for Multi-Tenant Membership
- **Date**: 2026-09-17
- **Decision**: Avoid embedding raw SQL subqueries that query self-referencing tables (`company_users`, `companies`, `profiles`) directly inside their own RLS `USING` clauses. Instead, route membership and tenant verification through `SECURITY DEFINER` helper functions (`current_user_has_company_role`, `current_user_is_super_admin`, `current_user_shares_company_with`).
- **Reason**: Direct subqueries on tables with active RLS policies trigger re-evaluation of the same policy during recursive execution, leading to PostgreSQL error `42P17: infinite recursion detected in policy for relation "company_users"`. `SECURITY DEFINER` functions bypass RLS inside their controlled execution frame, completely preventing recursion cycles while retaining strict caller-based permission evaluation (`auth.uid()`).
- **Alternatives Considered**: Disabling RLS on `company_users` (unacceptable multi-tenant security vulnerability).
- **Impact**: Zero recursion errors, fast evaluation using table primary/unique indexes, and complete protection of tenant membership data.

---

## ADR-015: Production Authentication Integration and Enterprise Tenant Establishment
- **Date**: 2026-09-17
- **Decision**: Transition application authentication from offline fallback mocking to live Supabase SSR authentication backed by `auth.users`, `public.profiles`, and `public.company_users`. Establish `Paguro Corp S.A.S.` as the primary corporate tenant (`c1111111-1111-1111-1111-111111111111`), provision standard Colombian tax rates (`IVA_19`, `IVA_5`, `IVA_0`), configure the initial Super Admin (`superadmin@pagurocorp.com`), and deploy the `handle_new_user()` trigger for automated profile lifecycle synchronization.
- **Reason**: Production enterprise operation requires strict cryptographic JWT validation, tenant isolation, and authoritative role mapping. Offline demo cookie fallbacks must never mask real authentication failures when Supabase is connected.
- **Alternatives Considered**: Retaining offline demo fallback bypasses in production (unacceptable security vulnerability).
- **Impact**: Zero-compromise security posture, guaranteed single-source-of-truth user credentials, and full RLS enforcement across all application interactions.

---

## ADR-016: Product Master Data, Inventory Movement Ledger, and Valuation Engine
- **Date**: 2026-09-17
- **Decision**: Decouple Products and Inventory Movements completely from local mock storage and establish the authoritative ledger-backed inventory model in Supabase. Stock is dynamically derived from `inventory_movements` (`get_product_stock()` and `quantity_delta` summation) rather than an editable scalar column. Negative stock is strictly rejected for physical items (`current_stock + quantity_delta >= 0`). Service products (`product_type = 'service'`) bypass inventory tracking. Inventory valuation follows the safe baseline model ($\text{current\_stock} \times \text{unit\_cost}$) with decimal-safe half-up rounding. Cross-company supplier and product integrity is enforced at the database layer via `validate_cross_company_integrity()` trigger and in server actions. Mutations are restricted to `SUPER_ADMIN`, `ADMIN`, and `OPERATIONS`, while `FINANCE`, `ACCOUNTANT`, and `VIEWER` are read-only. Every mutation appends an immutable entry to `audit_logs`.
- **Reason**: Physical stock represents high-risk company assets; manual direct scalar updates cause audit trail blindness, reconciliation failure, and phantom inventory. A movement-based ledger provides an indisputable, immutable transactional history.
- **Alternatives Considered**: Direct editable `stock_quantity` column on `products` (rejected due to lack of traceability); FIFO/LIFO lot tracking (deferred to advanced manufacturing milestone as specified in architecture).
- **Impact**: 100% auditable inventory history, strict multi-company isolation, zero negative stock anomalies, and automated valuation metrics.

---

## ADR-017: Sales Invoices, Customer Payments, Concurrency-Safe Numbering, and Inventory Synchronization
- **Date**: 2026-09-17
- **Decision**: Decouple Sales Invoices and Customer Payments completely from `mock-store.ts` and transition to the live Supabase architecture.
  1. **Concurrency-Safe Numbering**: Implement `public.generate_next_sales_invoice_number(p_company_id)` to generate sequential formatted numbers (`FAC-YYYY-00001`) atomically scoped to the company and calendar year, backed by the composite unique index `(company_id, invoice_number)`.
  2. **Authoritative Calculation & Line Item Invariants**: Client sums are untrusted. Calculations occur server-side with financial half-up rounding (`calculateLineItem` and `calculateDocumentTotals`). Database triggers `trg_calc_sales_invoice_item_values` and `trg_recalc_sales_invoice_totals` guarantee that line totals, tax sums, and invoice headers remain strictly consistent.
  3. **Strict Lifecycle**: Only invoices in `draft` status may have line items or parameters modified. Finalized invoices (`issued`, `partial`, `paid`) cannot be directly edited or deleted; modifications require voiding or adjustments. An invoice with active recorded payments (`paid_total > 0`) cannot be voided until payments are reversed or voided first.
  4. **Inventory Synchronization**: Draft invoices do not affect inventory. When an invoice transitions to `issued`, the server verifies stock availability and creates authoritative `SALE` movements (`quantity_delta = -quantity`) for physical tracked products. If an issued invoice is subsequently voided, compensatory `RETURN_IN` movements (`quantity_delta = +quantity`) are automatically recorded under `source_type = 'sales_invoice_void'`.
  5. **Payments & Overpayment Prevention**: Customer payments are recorded as first-class `payments` linked to `sales_invoices` via `payment_allocations`. Overpayments (`amount > balance_due`) and payments on `void` or `paid` invoices are strictly rejected. The database trigger `trg_payment_allocation_sync` atomically synchronizes `paid_total`, `balance_due`, and status (`partial` or `paid`).
  6. **Authorization & Audit**: Mutations are restricted to `SUPER_ADMIN`, `ADMIN`, and `FINANCE`. Void operations are strictly restricted to `SUPER_ADMIN` and `ADMIN`. All creations, status changes, voids, and payments append immutable entries to `audit_logs`.
- **Reason**: Sales invoices and cash receipts represent legal fiscal commitments and determine revenue, tax liabilities (IVA generado), and accounts receivable. Strong database triggers, atomic numbering, and strict role permissions prevent corruption and fraud.
- **Alternatives Considered**: Frontend-generated invoice numbers (rejected due to collision risk); direct destructive deletion of invoices (rejected to preserve legal financial audit trails).
- **Impact**: Zero phantom invoice numbers, mathematically indisputable line item taxes, automated stock decrement/increment, and complete company isolation.

## ADR-018: Purchase Documents, Accounts Payable (CxP), Deductible IVA, Withholding Tax, and Inventory Reception
- **Date**: 2026-09-17
- **Decision**: Decouple Purchases and Expenses completely from `mock-store.ts` and transition to the live Supabase architecture (`purchase_documents`, `purchase_document_items`, `payments`, `payment_allocations`, and `inventory_movements`).
  1. **Unified Architecture**: `purchase_documents` and `purchase_document_items` serve as the authoritative foundation for both physical vendor goods purchases and operational expenses (with `expenses` and `expense_items` serving as views).
  2. **Supplier Reference Numbering**: Unlike customer invoices with internal sequential numbering, purchases track the vendor's external bill number (`document_number`). Uniqueness is strictly enforced per company and supplier via composite index `UNIQUE(company_id, supplier_id, document_number)`.
  3. **Server-Side Financial Integrity**: Client calculations are untrusted. Calculations use strict 2-decimal half-up rounding (`roundHalfUp`). Subtotal, deductible IVA (`deductible_tax_total`), withholding taxes (`retention_total`), and net payable total (`subtotal + deductible_tax_total - retention_total`) are validated server-side and reinforced by database triggers `trg_calc_purchase_document_item_values` and `trg_recalc_purchase_document_totals`.
  4. **Strict Document Lifecycle**: Follows the database enum `'draft'` -> `'open'` -> `'partial'` -> `'paid'` -> `'void'`. Drafts are fully editable. Approved documents cannot be modified directly. Voiding is restricted to `SUPER_ADMIN` and `ADMIN`, and is strictly prevented if payments have been recorded (`paid_total > 0`).
  5. **Stock Reception & Reversal**: Physical tracked goods items on purchase documents generate authoritative `PURCHASE` inventory movements (`quantity_delta = +quantity`) upon transitioning to `'open'`. If an open purchase is voided, compensatory `RETURN_OUT` movements (`quantity_delta = -quantity`) are automatically posted under `source_type = 'purchase_document_void'`.
  6. **Accounts Payable Disbursements**: Outbound payments (`direction = 'outbound'`) are registered independently and allocated via `payment_allocations` (`document_type = 'purchase_document'`). The trigger `trg_payment_allocation_sync` maintains `paid_total` and `balance_due`. Overpayments (`amount > balance_due`) and payments against void documents are rejected server-side.
  7. **Security & Audit**: Cross-company supplier, product, or tax references fail. Read/write operations require valid role authorization, and all actions log before/after states to `audit_logs`.
- **Reason**: Accounts payable and deductible tax tracking must comply with tax authority audits (IVA descontable) and protect financial balances against fraudulent edits or orphan inventory entries.
- **Alternatives Considered**: Storing expenses and purchases in separate disconnected tables (rejected due to schema duplication and dual payment allocation complexity); allowing destructive deletions (rejected to preserve accounting audit trails).
- **Impact**: Real-time accounts payable tracking, accurate deductible IVA reporting, automated inventory reception, and zero reliance on mock storage.

## ADR-019: Operational IVA Calculation, Configurable Tax Periods, and Fiscal Period Locking
- **Date**: 2026-09-17
- **Decision**: Decouple IVA and Tax Periods completely from `mock-store.ts` and transition to the live Supabase architecture (`tax_periods`, `tax_adjustments`, `sales_invoices`, `purchase_documents`).
  1. **Operational Scope Disclaimer**: Paguro Finance is explicitly an internal operational financial control tool, NOT an official DIAN filing system. Tax calculations provide operational visibility and period traceability for management and accounting review, but do not replace certified tax returns.
  2. **Configurable Tax Periods**: Tax periods are fully configurable by date intervals (`period_start` to `period_end`) and not hard-coded to any single periodicity. Consecutive non-overlapping intervals are enforced per company and tax type.
  3. **Authoritative Transaction Filtering**:
     - **IVA Generado**: Derived strictly from non-void, finalized sales invoices (`status IN ('issued', 'partial', 'paid')`) with `issue_date` in the period. Draft and void invoices are strictly excluded.
     - **IVA Descontable**: Derived strictly from non-void, approved purchase documents (`status IN ('open', 'partial', 'paid')`) with `document_date` in the period. Draft and void purchases are strictly excluded.
  4. **Estimated Net Tax Formulation**:
     $$\text{net\_tax} = \text{generated\_tax} - \text{deductible\_tax} + \text{adjustments}$$
     - A positive result represents estimated tax payable to the tax authority.
     - A negative result represents an accumulated tax credit (saldo a favor).
  5. **Signed Manual Adjustments**: Authorized users (`SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`) can register audited adjustments (`INCREASE_GENERATED`, `DECREASE_GENERATED`, `INCREASE_DEDUCTIBLE`, `DECREASE_DEDUCTIBLE`, `OTHER_CREDIT`). Debit adjustments increase net payable tax; credit adjustments decrease net payable tax.
  6. **Strict Period Locking**: The status lifecycle is `'open'` -> `'reviewed'` -> `'closed'` -> `'reopened'`. When marked `'closed'`, the database trigger `prevent_closed_tax_period_modification` immediately blocks any insertion, update, or deletion of sales invoices or purchase documents falling within the period. Reopening requires administrative privileges and leaves an audit trail in `audit_logs`.
- **Reason**: Protect financial reporting integrity from retroactive document tampering while providing transparent drill-down into source records.
- **Alternatives Considered**: Automatically recalculating closed periods upon past invoice changes (rejected as it violates accounting period closing principles); hard-coding bi-monthly DIAN calendars (rejected to support arbitrary fiscal years and special regimes).
- **Impact**: True operational VAT traceability, immutable historical period locks, and complete mock decoupling.

### ADR-020: Private Document Storage, Multi-Tenant Storage Policies, and Authoritative Financial Reporting Engine
- **Status**: Accepted
- **Context**: Paguro Finance manages sensitive financial documents (electronic invoices, purchase bills, tax certificates, bank payment receipts) and core management reporting (Sales, Expenses, Accounts Receivable Aging, Accounts Payable Aging, VAT Summary, Inventory Valuation, Customer Balances, Supplier Balances, and Product Profitability). Public URLs or client-side report calculations violate multi-tenant security and accounting audit standards.
- **Decision**:
  1. **Private Supabase Storage Bucket**: The bucket `financial-documents` is configured with `public = false`. All file access is governed through 60-second time-to-live signed URLs (`storage.from('financial-documents').createSignedUrl(...)`) generated after company authorization checks.
  2. **Multi-Tenant Path Isolation & Storage Policies**: Objects are organized under `{company_id}/{entity_type}/{entity_id}/{timestamp}_{filename}`. PostgreSQL RLS policies on `storage.objects` verify that the root path component matches the user's active company membership before permitting `SELECT`, `INSERT`, or `DELETE`.
  3. **Database-Level Cross-Company Integrity**: The `validate_cross_company_integrity()` trigger validates that the referenced `entity_id` belongs to `NEW.company_id` for each entity type (`sales_invoice`, `purchase_document`, `payment`, `customer`, `supplier`, `tax_period`).
  4. **Server-Side Financial Reporting**: Balances, aging buckets (`current`, `1-30`, `31-60`, `61-90`, `90+` days overdue), inventory valuation (`current_stock * unit_cost`), and product profitability (Revenue, COGS, Gross Margin) are computed strictly on the server through dedicated Server Actions in `lib/actions/reports.ts`.
  5. **CSV Export with Audit Logging**: The export pipeline outputs RFC 4180 compliant CSV files with UTF-8 BOM encoding for seamless Excel compatibility and records an immutable log in `audit_logs` (`action = 'REPORT_EXPORT'`).
  6. **Role-Based Access Control**: `VIEWER` and `ACCOUNTANT` roles enjoy read-only access to documents and reports; document upload and archive operations are strictly restricted to `SUPER_ADMIN`, `ADMIN`, `FINANCE`, and `OPERATIONS`.
- **Reason**: Guarantees zero leak of financial documents across companies, eliminates permanent public URL exposure, ensures reliable aging analysis, and decouples both Documents and Reports entirely from `mock-store.ts`.
- **Alternatives Considered**: Serving files through public bucket URLs (rejected as financial documents contain confidential PII and tax data); computing aging buckets client-side (rejected as client clock skew produces conflicting reports).
- **Impact**: Enterprise-grade document confidentiality, authoritative consolidated reporting, and complete decoupling of `app/documents/page.tsx` and `app/reports/page.tsx` from mock data.

### ADR-021: Financial Dashboard Real Data Migration and Server-Side Metric Aggregation
- **Status**: Accepted
- **Context**: The main financial dashboard (`app/dashboard/page.tsx`) previously rendered static mock fixtures from `mock-store.ts` and fake hardcoded trends. In a multi-tenant enterprise system, the dashboard must accurately reflect the authenticated company's true financial standing across revenue, expenses, operating margin, A/R, A/P, estimated VAT, and inventory valuation without client-side calculation drift or mock remnants.
- **Decision**:
  1. **Consolidated Server-Side Action**: Implemented `getDashboardDataAction(period)` in `lib/actions/dashboard.ts`, which coordinates 10 parallel Supabase queries (`companies`, `sales_invoices`, `purchase_documents`, `products`, `inventory_movements`, `payments`) scoped to the user's `session.activeCompanyId`.
  2. **Authoritative Financial Status Filters**:
     - Net Sales & Inbound IVA include invoices in `status IN ('issued', 'partial', 'paid', 'overdue')` with `issue_date` within the selected period.
     - Operational Expenses & Deductible IVA include purchase documents in `status IN ('issued', 'partial', 'paid', 'overdue')` with `issue_date` within the selected period.
     - A/R and A/P represent cumulative open balance snapshots (`balance_due > 0`) independent of the period window, reflecting real-world liquidity commitments.
     - Operating margin is strictly computed as `roundHalfUp(netSales - totalExpenses)`.
  3. **Dynamic Multi-Company Selector**: Disconnected `components/layout/CompanySelector.tsx` from `INITIAL_COMPANIES` and tied it to `getAuthorizedCompaniesAction()` and `switchActiveCompanyAction()`. Users can only view and select companies where they possess an active membership in `company_users`.
  4. **Zero State & Loading UX**: When no records exist in the database, the dashboard renders clean zero states ($0 totals, 0 counts, and descriptive empty table states) rather than failing or showing simulated data.
  5. **Role Access**: Extended dashboard reading access to `VIEWER`, `ACCOUNTANT`, `FINANCE`, `ADMIN`, and `SUPER_ADMIN`.
- **Reason**: Provides immediate, truthful executive visibility into operational cash flow and financial health while enforcing RLS multi-tenant security and eliminating fake test metrics.
- **Alternatives Considered**: Having the dashboard make multiple separate REST calls for each widget (rejected due to network latency and waterfall overhead); computing KPIs in browser state (rejected to preserve single source of truth).
- **Impact**: High-performance dashboard loading, verified multi-company isolation, and decoupling of `app/dashboard/page.tsx` and `components/layout/CompanySelector.tsx` from `mock-store.ts`.




