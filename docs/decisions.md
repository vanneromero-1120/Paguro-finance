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


