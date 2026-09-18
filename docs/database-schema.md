# Paguro Finance - Database Schema Specification

This document defines the complete production database schema for **Paguro Finance**, hosted on PostgreSQL via Supabase.

---

## 1. Design Conventions & Standards

- **Primary Keys**: Every table uses a synthetic Primary Key of type `UUID` with default value `gen_random_uuid()`.
- **Financial Values**: All monetary amounts, balances, totals, unit prices, and tax sums are typed as `NUMERIC(14, 2)`. Floating point types (`FLOAT`, `REAL`, `DOUBLE PRECISION`) are strictly prohibited for financial data.
- **Percentages & Rates**: Tax rates and discounts use `NUMERIC(5, 4)` (e.g. 0.1900 for 19.00% IVA).
- **Quantities**: Quantities in line items use `NUMERIC(12, 4)` to support fractional or physical units, with a `CHECK (quantity > 0)` constraint. Ledger deltas in `inventory_movements` use `NUMERIC(12, 4)` (can be positive or negative, non-zero).
- **Timestamps**: All timestamps use `TIMESTAMPTZ` and default to `NOW()`. All dates without time components use `DATE`.
- **Tenant Isolation**: Every entity scoped to a company contains `company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`.
- **Audit Columns**: Every mutable operational table includes `created_at`, `updated_at`, `created_by`, and `updated_by` referencing `profiles(id)`.

---

## 2. Entity Relational Definitions

### 2.1 `companies`
Represents legal or operational business entities (e.g., Paguro Corp, Pagureo, Pagurai).
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `legal_name`: `VARCHAR(255) NOT NULL`
- `trade_name`: `VARCHAR(255) NOT NULL`
- `tax_id`: `VARCHAR(50) NOT NULL UNIQUE` (e.g., NIT / RUT)
- `country_code`: `VARCHAR(3) NOT NULL DEFAULT 'COL'`
- `currency_code`: `VARCHAR(3) NOT NULL DEFAULT 'COP'`
- `timezone`: `VARCHAR(50) NOT NULL DEFAULT 'America/Bogota'`
- `is_active`: `BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.2 `profiles`
User profiles synced with Supabase `auth.users`.
- `id`: `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `email`: `VARCHAR(255) NOT NULL UNIQUE`
- `full_name`: `VARCHAR(255) NOT NULL`
- `avatar_url`: `TEXT`
- `phone`: `VARCHAR(50)`
- `is_active`: `BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.3 `company_users`
Maps user membership to companies, establishing tenancy and RBAC role.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `user_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `role`: `VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'))`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended'))`
- `invited_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `last_access_at`: `TIMESTAMPTZ`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraint**: `UNIQUE(company_id, user_id)`

### 2.4 `customers`
Customer master directory per company.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `name`: `VARCHAR(255) NOT NULL`
- `legal_name`: `VARCHAR(255)`
- `identification_type`: `VARCHAR(20) NOT NULL DEFAULT 'NIT'` (e.g., NIT, CC, CE, PASSPORT)
- `tax_id`: `VARCHAR(50) NOT NULL`
- `email`: `VARCHAR(255)`
- `phone`: `VARCHAR(50)`
- `billing_address`: `TEXT`
- `city`: `VARCHAR(100)`
- `country`: `VARCHAR(100) DEFAULT 'Colombia'`
- `payment_terms_days`: `INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0)`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))`
- `notes`: `TEXT`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_by`: `UUID REFERENCES profiles(id)`
- **Constraint**: `UNIQUE(company_id, tax_id)`

### 2.5 `suppliers`
Supplier master directory per company.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `name`: `VARCHAR(255) NOT NULL`
- `legal_name`: `VARCHAR(255)`
- `identification_type`: `VARCHAR(20) NOT NULL DEFAULT 'NIT'`
- `tax_id`: `VARCHAR(50) NOT NULL`
- `email`: `VARCHAR(255)`
- `phone`: `VARCHAR(50)`
- `billing_address`: `TEXT`
- `city`: `VARCHAR(100)`
- `country`: `VARCHAR(100) DEFAULT 'Colombia'`
- `payment_terms_days`: `INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0)`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))`
- `notes`: `TEXT`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_by`: `UUID REFERENCES profiles(id)`
- **Constraint**: `UNIQUE(company_id, tax_id)`

### 2.6 `tax_rates`
Configurable tax definitions (e.g., IVA 19%, IVA 5%, Exento 0%).
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `code`: `VARCHAR(50) NOT NULL` (e.g., 'IVA_19', 'IVA_5', 'EXENTO_0')
- `name`: `VARCHAR(100) NOT NULL`
- `rate`: `NUMERIC(5, 4) NOT NULL CHECK (rate >= 0 AND rate <= 1)`
- `is_active`: `BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraint**: `UNIQUE(company_id, code)`

### 2.7 `products`
Product and service catalog for sales and inventory tracking.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `sku`: `VARCHAR(100) NOT NULL`
- `name`: `VARCHAR(255) NOT NULL`
- `description`: `TEXT`
- `category`: `VARCHAR(100)`
- `product_type`: `VARCHAR(50) NOT NULL DEFAULT 'physical' CHECK (product_type IN ('physical', 'service'))`
- `supplier_id`: `UUID REFERENCES suppliers(id)`
- `cost`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0)`
- `sale_price`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (sale_price >= 0)`
- `tax_rate_id`: `UUID NOT NULL REFERENCES tax_rates(id)`
- `stock_minimum`: `NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (stock_minimum >= 0)`
- `is_inventory_item`: `BOOLEAN NOT NULL DEFAULT TRUE`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived'))`
- `shopify_product_id`: `VARCHAR(100)`
- `shopify_variant_id`: `VARCHAR(100)`
- `barcode`: `VARCHAR(100)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_by`: `UUID REFERENCES profiles(id)`
- **Constraint**: `UNIQUE(company_id, sku)`

### 2.8 `sales_invoices`
Sales invoices headers.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `invoice_number`: `VARCHAR(50) NOT NULL`
- `customer_id`: `UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT`
- `issue_date`: `DATE NOT NULL`
- `due_date`: `DATE NOT NULL CHECK (due_date >= issue_date)`
- `currency_code`: `VARCHAR(3) NOT NULL DEFAULT 'COP'`
- `subtotal`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0)`
- `tax_total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0)`
- `discount_total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0)`
- `total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0)`
- `paid_total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_total >= 0)`
- `balance_due`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (balance_due >= 0)`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partial', 'paid', 'overdue', 'void'))`
- `notes`: `TEXT`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_by`: `UUID REFERENCES profiles(id)`
- `updated_by`: `UUID REFERENCES profiles(id)`
- **Constraint**: `UNIQUE(company_id, invoice_number)`

### 2.9 `sales_invoice_items`
Sales invoice line items.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `invoice_id`: `UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE`
- `product_id`: `UUID REFERENCES products(id) ON DELETE RESTRICT`
- `description`: `TEXT NOT NULL`
- `quantity`: `NUMERIC(12, 4) NOT NULL CHECK (quantity > 0)`
- `unit_price`: `NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0)`
- `discount_amount`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0)`
- `tax_rate_id`: `UUID NOT NULL REFERENCES tax_rates(id)`
- `tax_rate`: `NUMERIC(5, 4) NOT NULL CHECK (tax_rate >= 0)`
- `tax_amount`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0)`
- `line_total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.10 `purchase_documents`
Purchases and expense records from suppliers.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `document_number`: `VARCHAR(100) NOT NULL`
- `supplier_id`: `UUID REFERENCES suppliers(id) ON DELETE RESTRICT`
- `document_date`: `DATE NOT NULL`
- `due_date`: `DATE NOT NULL`
- `category`: `VARCHAR(100) NOT NULL` (e.g., 'OPERATING', 'INVENTORY', 'LOGISTICS', 'MARKETING', 'PAYROLL', 'SERVICES')
- `currency_code`: `VARCHAR(3) NOT NULL DEFAULT 'COP'`
- `subtotal`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0)`
- `deductible_tax_total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (deductible_tax_total >= 0)`
- `retention_total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (retention_total >= 0)`
- `total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0)`
- `paid_total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_total >= 0)`
- `balance_due`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (balance_due >= 0)`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'partial', 'paid', 'void'))`
- `notes`: `TEXT`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_by`: `UUID REFERENCES profiles(id)`
- `updated_by`: `UUID REFERENCES profiles(id)`
- **Constraint**: `UNIQUE(company_id, supplier_id, document_number)`

### 2.11 `purchase_document_items`
Line items for purchase documents.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `purchase_document_id`: `UUID NOT NULL REFERENCES purchase_documents(id) ON DELETE CASCADE`
- `product_id`: `UUID REFERENCES products(id) ON DELETE RESTRICT`
- `description`: `TEXT NOT NULL`
- `quantity`: `NUMERIC(12, 4) NOT NULL CHECK (quantity > 0)`
- `unit_price`: `NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0)`
- `tax_rate_id`: `UUID REFERENCES tax_rates(id)`
- `tax_rate`: `NUMERIC(5, 4) NOT NULL DEFAULT 0.0000`
- `tax_amount`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0)`
- `line_total`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.12 `payments`
Unified cash movement ledger for customer collections and supplier payments.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `direction`: `VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound'))`
- `payment_date`: `DATE NOT NULL`
- `amount`: `NUMERIC(14, 2) NOT NULL CHECK (amount > 0)`
- `method`: `VARCHAR(50) NOT NULL` (e.g., 'BANK_TRANSFER', 'CASH', 'CREDIT_CARD', 'CHECK', 'PLATFORM')
- `reference`: `VARCHAR(100)`
- `counterparty_type`: `VARCHAR(20) NOT NULL CHECK (counterparty_type IN ('customer', 'supplier'))`
- `counterparty_id`: `UUID NOT NULL`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void'))`
- `notes`: `TEXT`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_by`: `UUID REFERENCES profiles(id)`

### 2.13 `payment_allocations`
Cross-table linking payments to specific documents.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `payment_id`: `UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT`
- `document_type`: `VARCHAR(30) NOT NULL CHECK (document_type IN ('sales_invoice', 'purchase_document'))`
- `document_id`: `UUID NOT NULL`
- `amount`: `NUMERIC(14, 2) NOT NULL CHECK (amount > 0)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.14 `inventory_movements`
Strict double-entry style ledger of all inventory increments and decrements.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `product_id`: `UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT`
- `movement_type`: `VARCHAR(50) NOT NULL CHECK (movement_type IN ('PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGED', 'TRANSFER_IN', 'TRANSFER_OUT'))`
- `movement_date`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `quantity_delta`: `NUMERIC(12, 4) NOT NULL CHECK (quantity_delta != 0)`
- `unit_cost`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0)`
- `source_type`: `VARCHAR(50)` (e.g., 'sales_invoice', 'purchase_document', 'manual_adjustment')
- `source_id`: `UUID`
- `reason`: `TEXT`
- `created_by`: `UUID REFERENCES profiles(id)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.15 `tax_periods`
Configurable tax periods for periodic VAT reconciliation.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `tax_type`: `VARCHAR(50) NOT NULL DEFAULT 'IVA'`
- `period_start`: `DATE NOT NULL`
- `period_end`: `DATE NOT NULL CHECK (period_end >= period_start)`
- `generated_tax`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00`
- `deductible_tax`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00`
- `adjustments`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00`
- `net_tax`: `NUMERIC(14, 2) NOT NULL DEFAULT 0.00`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed', 'reopened'))`
- `notes`: `TEXT`
- `closed_at`: `TIMESTAMPTZ`
- `closed_by`: `UUID REFERENCES profiles(id)`
- `created_by`: `UUID REFERENCES profiles(id)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraint**: `UNIQUE(company_id, tax_type, period_start, period_end)`

### 2.16 `tax_adjustments`
Authorized manual tax adjustments linked to specific periods.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tax_period_id`: `UUID NOT NULL REFERENCES tax_periods(id) ON DELETE RESTRICT`
- `adjustment_type`: `VARCHAR(50) NOT NULL CHECK (adjustment_type IN ('INCREASE_GENERATED', 'DECREASE_GENERATED', 'INCREASE_DEDUCTIBLE', 'DECREASE_DEDUCTIBLE', 'OTHER_CREDIT'))`
- `amount`: `NUMERIC(14, 2) NOT NULL CHECK (amount != 0)`
- `reason`: `TEXT NOT NULL`
- `document_id`: `UUID REFERENCES documents(id)`
- `created_by`: `UUID REFERENCES profiles(id)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.17 `documents`
Metadata for physical/digital file attachments stored in Supabase Storage (`financial-documents` private bucket).
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT`
- `entity_type`: `VARCHAR(50) NOT NULL` (e.g., 'sales_invoice', 'purchase_document', 'expense', 'payment', 'customer', 'supplier', 'tax_period')
- `entity_id`: `UUID NOT NULL`
- `storage_path`: `TEXT NOT NULL` (Format: `{company_id}/{entity_type}/{entity_id}/{timestamp}_{filename}`)
- `file_name`: `VARCHAR(255) NOT NULL`
- `mime_type`: `VARCHAR(100) NOT NULL` (e.g., 'application/pdf', 'image/jpeg', 'image/png')
- `file_size_bytes`: `BIGINT NOT NULL`
- `version`: `INTEGER NOT NULL DEFAULT 1`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'archived'))`
- `notes`: `TEXT`
- `uploaded_by`: `UUID REFERENCES profiles(id)`
- `uploaded_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Storage Bucket**: `financial-documents` (private, 25MB file limit, 60s signed URL TTL).
- **Storage Policies**: Multi-tenant folder RLS on `storage.objects` (`((storage.foldername(name))[1])::uuid = company_id`).
- **Integrity**: Enforced by trigger `validate_cross_company_integrity()` ensuring referenced `entity_id` belongs to `company_id`.


### 2.18 `audit_logs`
Immutable audit ledger for security, financial changes, and governance.
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id`: `UUID REFERENCES companies(id) ON DELETE SET NULL`
- `user_id`: `UUID REFERENCES profiles(id) ON DELETE SET NULL`
- `action`: `VARCHAR(50) NOT NULL` (e.g., 'CREATE', 'UPDATE', 'VOID', 'PAYMENT', 'INVENTORY_ADJUSTMENT', 'ROLE_CHANGE', 'TAX_CLOSE', 'TAX_REOPEN')
- `entity_type`: `VARCHAR(50) NOT NULL`
- `entity_id`: `UUID NOT NULL`
- `before_json`: `JSONB`
- `after_json`: `JSONB`
- `ip_or_context`: `TEXT`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

---

## 3. Database Indexes

- `idx_company_users_lookup`: ON `company_users (company_id, user_id, status)`
- `idx_sales_invoices_company_status_date`: ON `sales_invoices (company_id, status, issue_date)`
- `idx_sales_invoices_customer`: ON `sales_invoices (customer_id)`
- `idx_purchase_documents_company_status_date`: ON `purchase_documents (company_id, status, document_date)`
- `idx_purchase_documents_supplier`: ON `purchase_documents (supplier_id)`
- `idx_inventory_movements_prod_date`: ON `inventory_movements (company_id, product_id, movement_date)`
- `idx_payments_company_date`: ON `payments (company_id, payment_date, direction)`
- `idx_payment_allocations_doc`: ON `payment_allocations (document_type, document_id)`
- `idx_tax_periods_lookup`: ON `tax_periods (company_id, tax_type, period_start, period_end)`
- `idx_audit_logs_company_entity`: ON `audit_logs (company_id, entity_type, entity_id, created_at)`
- `idx_documents_entity`: ON `documents (company_id, entity_type, entity_id)`
