-- ============================================================================
-- Paguro Finance - Migration 00001: Initial Schema
-- Production-ready schema with multi-tenancy, strict constraints, and indexes
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. COMPANIES
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50) NOT NULL UNIQUE,
    country_code VARCHAR(3) NOT NULL DEFAULT 'COL',
    currency_code VARCHAR(3) NOT NULL DEFAULT 'COP',
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. USER PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. COMPANY MEMBERSHIP & ROLES
CREATE TABLE IF NOT EXISTS company_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_access_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_user UNIQUE(company_id, user_id)
);

-- 4. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    identification_type VARCHAR(20) NOT NULL DEFAULT 'NIT',
    tax_id VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    billing_address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Colombia',
    payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    CONSTRAINT uq_customer_tax_id UNIQUE(company_id, tax_id)
);

-- 5. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    identification_type VARCHAR(20) NOT NULL DEFAULT 'NIT',
    tax_id VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    billing_address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Colombia',
    payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    CONSTRAINT uq_supplier_tax_id UNIQUE(company_id, tax_id)
);

-- 6. TAX RATES
CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    rate NUMERIC(5, 4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_tax_code UNIQUE(company_id, code)
);

-- 7. PRODUCTS CATALOG
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    product_type VARCHAR(50) NOT NULL DEFAULT 'physical' CHECK (product_type IN ('physical', 'service')),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0),
    sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (sale_price >= 0),
    tax_rate_id UUID NOT NULL REFERENCES tax_rates(id) ON DELETE RESTRICT,
    stock_minimum NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (stock_minimum >= 0),
    is_inventory_item BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    shopify_product_id VARCHAR(100),
    shopify_variant_id VARCHAR(100),
    barcode VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    CONSTRAINT uq_product_sku UNIQUE(company_id, sku)
);

-- 8. SALES INVOICES
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'COP',
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
    discount_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    paid_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_total >= 0),
    balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (balance_due >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partial', 'paid', 'overdue', 'void')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    CONSTRAINT uq_sales_invoice_number UNIQUE(company_id, invoice_number),
    CONSTRAINT chk_invoice_due_date CHECK (due_date >= issue_date)
);

-- 9. SALES INVOICE ITEMS
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_rate_id UUID NOT NULL REFERENCES tax_rates(id) ON DELETE RESTRICT,
    tax_rate NUMERIC(5, 4) NOT NULL CHECK (tax_rate >= 0),
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PURCHASE DOCUMENTS (EXPENSES / SUPPLIER BILLS)
CREATE TABLE IF NOT EXISTS purchase_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    document_number VARCHAR(100) NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
    document_date DATE NOT NULL,
    due_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'COP',
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    deductible_tax_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (deductible_tax_total >= 0),
    retention_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (retention_total >= 0),
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    paid_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_total >= 0),
    balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (balance_due >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'partial', 'paid', 'void')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),
    CONSTRAINT uq_purchase_doc UNIQUE(company_id, supplier_id, document_number)
);

-- 11. PURCHASE DOCUMENT ITEMS
CREATE TABLE IF NOT EXISTS purchase_document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_document_id UUID NOT NULL REFERENCES purchase_documents(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    description TEXT NOT NULL,
    quantity NUMERIC(12, 4) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE RESTRICT,
    tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. PAYMENTS (CASH MOVEMENTS)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    payment_date DATE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    method VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    counterparty_type VARCHAR(20) NOT NULL CHECK (counterparty_type IN ('customer', 'supplier')),
    counterparty_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- 13. PAYMENT ALLOCATIONS
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('sales_invoice', 'purchase_document')),
    document_id UUID NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. INVENTORY MOVEMENTS LEDGER
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 
        'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGED', 
        'TRANSFER_IN', 'TRANSFER_OUT'
    )),
    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quantity_delta NUMERIC(12, 4) NOT NULL CHECK (quantity_delta != 0),
    unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    source_type VARCHAR(50),
    source_id UUID,
    reason TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. TAX PERIODS (IVA)
CREATE TABLE IF NOT EXISTS tax_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    tax_type VARCHAR(50) NOT NULL DEFAULT 'IVA',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    generated_tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    deductible_tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    adjustments NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    net_tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed', 'reopened')),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tax_period UNIQUE(company_id, tax_type, period_start, period_end),
    CONSTRAINT chk_tax_period_dates CHECK (period_end >= period_start)
);

-- 16. TAX ADJUSTMENTS
CREATE TABLE IF NOT EXISTS tax_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_period_id UUID NOT NULL REFERENCES tax_periods(id) ON DELETE RESTRICT,
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN (
        'INCREASE_GENERATED', 'DECREASE_GENERATED', 
        'INCREASE_DEDUCTIBLE', 'DECREASE_DEDUCTIBLE', 
        'OTHER_CREDIT'
    )),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount != 0),
    reason TEXT NOT NULL,
    document_id UUID,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. DOCUMENTS METADATA (SUPABASE STORAGE ATTACHMENTS)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'archived')),
    uploaded_by UUID REFERENCES profiles(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. AUDIT LOGS (IMMUTABLE AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    before_json JSONB,
    after_json JSONB,
    ip_or_context TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_company_users_lookup ON company_users(company_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_company_status_date ON sales_invoices(company_id, status, issue_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_invoice ON sales_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_documents_company_status_date ON purchase_documents(company_id, status, document_date);
CREATE INDEX IF NOT EXISTS idx_purchase_documents_supplier ON purchase_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_document_items_doc ON purchase_document_items(purchase_document_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_prod_date ON inventory_movements(company_id, product_id, movement_date);
CREATE INDEX IF NOT EXISTS idx_payments_company_date ON payments(company_id, payment_date, direction);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_doc ON payment_allocations(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_tax_periods_lookup ON tax_periods(company_id, tax_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tax_adjustments_period ON tax_adjustments(tax_period_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_entity ON audit_logs(company_id, entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(company_id, entity_type, entity_id);
