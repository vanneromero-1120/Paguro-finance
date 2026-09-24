# Paguro Finance — Version 1 Scope

## Executive Summary
Paguro Finance is being restructured into a 4-version product (V1, V2, V3, V4).
**Version 1 is strictly a Financial Intelligence + Tax Operations System for Paguro.**

Development Philosophy:
**BUILD V1 → TEST WITH REAL DATA → VALIDATE FINANCIAL + TAX LOGIC → FIX PROBLEMS → STABILIZE → THEN START V2.**

---

## What Belongs to V1 (IN SCOPE)

### 1. Financial Movement Engine (`financial_movements`)
- Central normalized financial event ledger for all company transactions.
- Fields: `id`, `company_id`, `movement_date`, `direction` (INCOME / EXPENSE), `movement_type`, `source_type` (BANK, PAYMENT_PLATFORM, ACCOUNTING_DOCUMENT, MANUAL, IMPORT, SYSTEM), `source_id`, `description`, `counterparty`, `counterparty_tax_id`, `original_amount`, `currency`, `exchange_rate`, `amount_cop`, `category_id`, `subcategory_id`, `payment_method`, `bank_account_id`, `tax_relevance`, `tax_status`, `document_id`, `external_reference`, `confidence_score`, `review_status`, `created_by`, `created_at`, `updated_at`.
- Strict multi-company RLS isolation.

### 2. Movement Categories (`movement_categories`)
- Database-backed, company-scoped hierarchical categories:
  - Payroll & People
  - Software & Subscriptions
  - Marketing & Advertising
  - Professional Services
  - Logistics
  - Inventory / COGS
  - Taxes & Government
  - Banking & Financial Costs
  - Travel
  - Utilities
  - Office & Operations
  - Equipment
  - Income / Sales
  - Other Income
  - Other Expenses
- Subcategory support.

### 3. Banking Layer (`bank_accounts`, `bank_transactions`)
- `bank_accounts`: Institution, account name, type, masked number, currency, integration provider, status, last sync.
- `bank_transactions`: Inflow/outflow bank transaction records with match status (`UNMATCHED`, `SUGGESTED_MATCH`, `MATCHED`, `IGNORED`, `REVIEW_REQUIRED`).
- Bank Reconciliation Engine: Automatic matching suggestions, confidence scoring, manual confirmation, manual unmatch, zero silent irreversible decisions.

### 4. Google Drive Document Ingestion Pipeline
- Architectural data source connecting to Paguro's accounting Google Drive folder (from ~September 2025 onward).
- Pipeline statuses: `DISCOVERED` → `ACCESSED` → `CLASSIFIED` → `EXTRACTED` → `VALIDATED` → `MATCHED` → `REQUIRES_REVIEW` → `ACCEPTED` / `REJECTED`.
- Support for multi-document operations (e.g. Commercial Invoice + Packing List + Bill of Lading + SWIFT = 1 transaction).
- Safe incremental sync tracking Drive file ID and path.

### 5. AI Document Extraction Layer
- Structured extraction: Document type, document number, date, issuer & tax ID, receiver & tax ID, currency, subtotal, IVA, withholding, other taxes, total, payment method, payment reference, due date, suggested category, confidence score.
- Low-confidence extractions automatically routed to `REQUIRES_REVIEW`. User manual correction interface.

### 6. Duplicate Prevention Engine
- Signals: Invoice number, tax ID, amount, date, payment reference, bank reference, Drive document ID, external transaction ID.
- Prevents double-counting when both invoice and payment receipt exist.

### 7. Tax Data Model & Colombian Tax Context
- Transaction tax relevance: taxable, non-taxable, IVA generated, IVA deductible, withholding, income tax relevance, jurisdiction, counterparty tax ID, document type, tax period.
- Support for Colombian fiscal realities: IVA, Retención en la fuente, ICA, Renta, RUT responsibilities, DIAN obligations, electronic invoice support, tax periods.
- `company_tax_profile`: Tax regime, RUT responsibilities, IVA responsibility, withholding agent status, ICA configuration by municipality, fiscal year, contacts.
- Labels: `ESTIMATED`, `REVIEW_REQUIRED`, `VERIFIED`.

### 8. Tax Obligations & Calendar (`tax_obligations`)
- Tax obligations tracker: name, tax_type, period, due_date, estimated_amount, actual_amount, status (`UPCOMING`, `DUE_SOON`, `DUE_TODAY`, `OVERDUE`, `PREPARED`, `FILED`, `PAID`, `NOT_APPLICABLE`), source, confidence, review_status, evidence document, responsible user.
- Interactive calendar views: Month, Quarter, Year.
- Tax notification engine: 30, 15, 7, 3, 1 days before, due date, overdue across in-app, email, WhatsApp, Slack.

### 9. AI Financial + Tax Advisor (`Asesor IA`)
- Dedicated assistant module with standard time windows: 7d, 30d, current month, previous month, current quarter, previous quarter, 12m, current year, custom.
- Read-only structured tools: `get_financial_summary`, `get_expenses_by_category`, `get_income_summary`, `get_tax_summary`, `get_upcoming_obligations`, `get_unreconciled_transactions`, `get_document_status`, `get_period_comparison`, `get_top_expenses`, `get_cash_flow_summary`.
- Complete traceability (period, transaction count, categories, calculation basis, source documents).
- Strict tax safety disclaimers: Financial observation vs tax interpretation vs official tax obligation.

### 10. Integrations Architecture (`Integraciones`)
- Provider abstractions for: Google Drive, Banking APIs/Plaid/Belvo, Payment Platforms (Stripe, PayPal, Shopify Payments, Mercado Pago, Wompi, Addi, PayU), AI Provider, Notification services.
- Real statuses: Connected, Needs Attention, Disconnected, Not Configured.
- Idempotent sync engine with full sync logging (`sync_logs`).

### 11. Human Review Queue
- Central review queue for: Unknown movements, unknown categories, low-confidence documents, duplicate candidates, unmatched bank transactions, missing supporting documents, unknown tax treatments.

### 12. V1 Dashboard & Simplified Navigation
- V1 Sidebar Navigation:
  1. Dashboard
  2. Movimientos
  3. Documentos
  4. Impuestos
  5. Obligaciones
  6. Asesor IA
  7. Integraciones
  8. Configuración
- V1 Dashboard KPI Cards: Cash Position, Ingresos, Egresos, Flujo Neto, Gastos por Categoría, Movimientos sin Conciliar, Documentos Pendientes, IVA Estimado, Próxima Obligación Tributaria.
- Sections: Cash Overview, Expense Analysis, Banking, Tax, Document Health, Recent Activity.

### 13. Paguro Brand Identity
- Official Paguro logo, white logo, and isotype ("eo" infinity symbol).
- Palette tokens:
  - `--paguro-blue: #0098FF`
  - `--paguro-pink: #E72175`
  - `--paguro-navy: #1E293E`
  - `--paguro-white: #FFFFFF`
- Typography: Montserrat (headings) + Inter (body/UI).
- Consistent branding across login, sidebar, header, cards, tables, badges, favicons, app icons, and responsive layouts.

---

## What is NOT in V1 (DEFERRED / HIDDEN)

The following modules exist or are deferred, and are **HIDDEN from V1 navigation** while preserving database integrity:
- Full ERP inventory management (`/inventory/*` hidden)
- Customer relationship management / CRM (`/sales/customers` hidden)
- Sales invoicing generator (`/sales/invoices` hidden)
- Manual purchase document itemization (`/purchases/*` hidden)
- Official payroll processing (payroll expenses are handled as movements)
- Full double-entry accounting ledgers
- Automated DIAN filing or automated tax payments
- Multi-entity consolidation and budget forecasting

---

## Existing Modules Classification

| Module / Architecture | Classification | Justification / Action |
|---|---|---|
| Multi-company isolation & RLS | **KEEP** | Core security foundation; company scoped |
| Profiles, Roles & RBAC (6 roles) | **KEEP** | Essential authorization matrix |
| Supabase Auth & Session middleware | **ADAPT** | Brand with Paguro logo & palette |
| Audit Logs (`audit_logs`) | **KEEP & ADAPT** | Extend to log movements, categories, obligations |
| Documents storage (`financial-documents`) | **KEEP & ADAPT** | Extend with Google Drive metadata & extraction pipeline |
| Tax Periods & Adjustments | **KEEP & ADAPT** | Integrate into Colombian Tax Operations |
| Dashboard | **ADAPT** | Reorganize around V1 KPIs and sections |
| Reports | **KEEP & ADAPT** | Keep financial and tax reports accessible |
| Sales Invoices & Customers (`/sales/*`) | **HIDE FROM V1** | Keep DB tables intact; hide from sidebar |
| Inventory Products & Movements (`/inventory/*`) | **HIDE FROM V1** | Keep DB tables intact; hide from sidebar |
| Purchases & Suppliers (`/purchases/*`) | **HIDE FROM V1** | Keep DB tables intact; hide from sidebar |
| Settings (`/settings/*`) | **ADAPT** | Add Company Tax Profile alongside users & audit |
| Brand Assets & Favicons | **ADAPT** | Official Paguro logo, isotype, and color system |
