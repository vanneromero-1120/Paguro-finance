-- ============================================================================
-- Paguro Finance - Migration 00010: Version 1 Financial Intelligence & Tax Schema
-- Adds:
-- 1. movement_categories (Company-scoped hierarchical categories)
-- 2. bank_accounts (Banking models)
-- 3. financial_movements (Central normalized movements ledger)
-- 4. bank_transactions (Bank statement & API transaction layer)
-- 5. documents extensions (Google Drive ingestion & AI extraction pipeline)
-- 6. company_tax_profile (Colombian tax configuration)
-- 7. tax_obligations (Calendar & compliance tracking)
-- 8. tax_notifications (Automated reminder alerts)
-- 9. integration_connections & sync_logs (Idempotent sync engine)
-- 10. RLS policies on all new tables
-- ============================================================================

-- 1. MOVEMENT CATEGORIES
CREATE TABLE IF NOT EXISTS public.movement_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    parent_id UUID REFERENCES public.movement_categories(id) ON DELETE CASCADE,
    color TEXT,
    icon TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_company_category_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_movement_categories_company ON public.movement_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_movement_categories_parent ON public.movement_categories(parent_id);

-- 2. BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    institution TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'CHECKING',
    masked_account_number TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'COP',
    integration_provider TEXT,
    external_account_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SYNC_ERROR')),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON public.bank_accounts(company_id);

-- 3. FINANCIAL MOVEMENTS (Central Ledger)
CREATE TABLE IF NOT EXISTS public.financial_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    movement_date DATE NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('INCOME', 'EXPENSE')),
    movement_type TEXT NOT NULL DEFAULT 'STANDARD',
    source_type TEXT NOT NULL CHECK (source_type IN ('BANK', 'PAYMENT_PLATFORM', 'ACCOUNTING_DOCUMENT', 'MANUAL', 'IMPORT', 'SYSTEM')),
    source_id TEXT,
    description TEXT NOT NULL,
    counterparty TEXT,
    counterparty_tax_id TEXT,
    original_amount NUMERIC(14,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'COP',
    exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
    amount_cop NUMERIC(14,2) NOT NULL,
    category_id UUID REFERENCES public.movement_categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.movement_categories(id) ON DELETE SET NULL,
    payment_method TEXT,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    tax_relevance TEXT NOT NULL DEFAULT 'TAXABLE',
    tax_status TEXT NOT NULL DEFAULT 'PENDING_MAPPING',
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    external_reference TEXT,
    confidence_score NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    review_status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (review_status IN ('CONFIRMED', 'REQUIRES_REVIEW', 'FLAGGED', 'RESOLVED')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_movements_company_date ON public.financial_movements(company_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_movements_direction ON public.financial_movements(company_id, direction);
CREATE INDEX IF NOT EXISTS idx_financial_movements_category ON public.financial_movements(category_id);
CREATE INDEX IF NOT EXISTS idx_financial_movements_source ON public.financial_movements(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_financial_movements_review ON public.financial_movements(company_id, review_status);

-- 4. BANK TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    external_transaction_id TEXT,
    posted_at TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'COP',
    direction TEXT NOT NULL CHECK (direction IN ('INFLOW', 'OUTFLOW')),
    balance_after NUMERIC(14,2),
    merchant TEXT,
    counterparty TEXT,
    reference TEXT,
    raw_source JSONB DEFAULT '{}'::JSONB,
    match_status TEXT NOT NULL DEFAULT 'UNMATCHED' CHECK (match_status IN ('UNMATCHED', 'SUGGESTED_MATCH', 'MATCHED', 'IGNORED', 'REVIEW_REQUIRED')),
    financial_movement_id UUID REFERENCES public.financial_movements(id) ON DELETE SET NULL,
    confidence_score NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON public.bank_transactions(bank_account_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_match_status ON public.bank_transactions(company_id, match_status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_movement ON public.bank_transactions(financial_movement_id);

-- 5. EXTEND DOCUMENTS TABLE FOR DRIVE INGESTION & AI EXTRACTION
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'drive_file_id') THEN
        ALTER TABLE public.documents ADD COLUMN drive_file_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'drive_folder_path') THEN
        ALTER TABLE public.documents ADD COLUMN drive_folder_path TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'document_type') THEN
        ALTER TABLE public.documents ADD COLUMN document_type TEXT DEFAULT 'OTHER_SUPPORT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'source_url') THEN
        ALTER TABLE public.documents ADD COLUMN source_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'document_date') THEN
        ALTER TABLE public.documents ADD COLUMN document_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'counterparty_name') THEN
        ALTER TABLE public.documents ADD COLUMN counterparty_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'counterparty_tax_id') THEN
        ALTER TABLE public.documents ADD COLUMN counterparty_tax_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'invoice_number') THEN
        ALTER TABLE public.documents ADD COLUMN invoice_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'currency') THEN
        ALTER TABLE public.documents ADD COLUMN currency TEXT DEFAULT 'COP';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'subtotal') THEN
        ALTER TABLE public.documents ADD COLUMN subtotal NUMERIC(14,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'tax_iva') THEN
        ALTER TABLE public.documents ADD COLUMN tax_iva NUMERIC(14,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'tax_withholding') THEN
        ALTER TABLE public.documents ADD COLUMN tax_withholding NUMERIC(14,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'tax_other') THEN
        ALTER TABLE public.documents ADD COLUMN tax_other NUMERIC(14,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'total_amount') THEN
        ALTER TABLE public.documents ADD COLUMN total_amount NUMERIC(14,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'payment_method') THEN
        ALTER TABLE public.documents ADD COLUMN payment_method TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'payment_reference') THEN
        ALTER TABLE public.documents ADD COLUMN payment_reference TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'due_date') THEN
        ALTER TABLE public.documents ADD COLUMN due_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'suggested_category_id') THEN
        ALTER TABLE public.documents ADD COLUMN suggested_category_id UUID REFERENCES public.movement_categories(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'confidence_score') THEN
        ALTER TABLE public.documents ADD COLUMN confidence_score NUMERIC(5,2) DEFAULT 0.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'pipeline_status') THEN
        ALTER TABLE public.documents ADD COLUMN pipeline_status TEXT DEFAULT 'DISCOVERED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'extracted_data') THEN
        ALTER TABLE public.documents ADD COLUMN extracted_data JSONB DEFAULT '{}'::JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'financial_movement_id') THEN
        ALTER TABLE public.documents ADD COLUMN financial_movement_id UUID REFERENCES public.financial_movements(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'review_notes') THEN
        ALTER TABLE public.documents ADD COLUMN review_notes TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_pipeline_status ON public.documents(company_id, pipeline_status);
CREATE INDEX IF NOT EXISTS idx_documents_movement_link ON public.documents(financial_movement_id);

-- 6. COMPANY TAX PROFILE
CREATE TABLE IF NOT EXISTS public.company_tax_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    tax_id TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'Colombia',
    city TEXT NOT NULL DEFAULT 'Medellín',
    municipality TEXT NOT NULL DEFAULT 'Medellín',
    tax_regime TEXT NOT NULL DEFAULT 'RESPONSABLE_DE_IVA',
    rut_responsibilities TEXT[] NOT NULL DEFAULT ARRAY['05 - Impto sobre la renta y compl', '48 - Impuesto sobre las ventas - IVA']::TEXT[],
    iva_responsible BOOLEAN NOT NULL DEFAULT true,
    income_tax_responsibility BOOLEAN NOT NULL DEFAULT true,
    withholding_agent BOOLEAN NOT NULL DEFAULT false,
    ica_configuration JSONB NOT NULL DEFAULT '{"rate": 0.007, "municipality": "Medellín", "activity_code": "6201"}'::JSONB,
    fiscal_year INTEGER NOT NULL DEFAULT 2026,
    accounting_contact TEXT,
    tax_advisor_contact TEXT,
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TAX OBLIGATIONS
CREATE TABLE IF NOT EXISTS public.tax_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tax_type TEXT NOT NULL,
    period TEXT NOT NULL,
    due_date DATE NOT NULL,
    estimated_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    actual_amount NUMERIC(14,2),
    status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'PREPARED', 'FILED', 'PAID', 'NOT_APPLICABLE')),
    source TEXT NOT NULL DEFAULT 'ESTIMATED_CALCULATION',
    confidence NUMERIC(5,2) NOT NULL DEFAULT 0.90,
    review_status TEXT NOT NULL DEFAULT 'ESTIMATED' CHECK (review_status IN ('ESTIMATED', 'REVIEW_REQUIRED', 'VERIFIED')),
    notes TEXT,
    evidence_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    responsible_user UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    filed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_obligations_due_date ON public.tax_obligations(company_id, due_date ASC);
CREATE INDEX IF NOT EXISTS idx_tax_obligations_status ON public.tax_obligations(company_id, status);

-- 8. TAX NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.tax_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    tax_obligation_id UUID REFERENCES public.tax_obligations(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'WHATSAPP', 'SLACK')),
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('DAYS_30', 'DAYS_15', 'DAYS_7', 'DAYS_3', 'DAYS_1', 'DUE_DATE', 'OVERDUE')),
    scheduled_for DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DISMISSED')),
    sent_at TIMESTAMPTZ,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_notifications_scheduled ON public.tax_notifications(company_id, scheduled_for, status);

-- 9. INTEGRATION CONNECTIONS & SYNC LOGS
CREATE TABLE IF NOT EXISTS public.integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (status IN ('CONNECTED', 'NEEDS_ATTENTION', 'DISCONNECTED', 'NOT_CONFIGURED')),
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'IDLE' CHECK (sync_status IN ('IDLE', 'SYNCING', 'SUCCESS', 'ERROR')),
    error_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_company_provider UNIQUE (company_id, provider)
);

CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    sync_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sync_finished_at TIMESTAMPTZ,
    records_found INTEGER NOT NULL DEFAULT 0,
    records_created INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    error_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_company ON public.sync_logs(company_id, sync_started_at DESC);

-- 10. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.movement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_tax_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- 11. RLS POLICIES (Using public.current_user_has_company_role)

-- movement_categories
DROP POLICY IF EXISTS "movement_categories_select_policy" ON public.movement_categories;
CREATE POLICY "movement_categories_select_policy" ON public.movement_categories
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "movement_categories_modify_policy" ON public.movement_categories;
CREATE POLICY "movement_categories_modify_policy" ON public.movement_categories
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])
    );

-- bank_accounts
DROP POLICY IF EXISTS "bank_accounts_select_policy" ON public.bank_accounts;
CREATE POLICY "bank_accounts_select_policy" ON public.bank_accounts
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "bank_accounts_modify_policy" ON public.bank_accounts;
CREATE POLICY "bank_accounts_modify_policy" ON public.bank_accounts
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])
    );

-- financial_movements
DROP POLICY IF EXISTS "financial_movements_select_policy" ON public.financial_movements;
CREATE POLICY "financial_movements_select_policy" ON public.financial_movements
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "financial_movements_modify_policy" ON public.financial_movements;
CREATE POLICY "financial_movements_modify_policy" ON public.financial_movements
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])
    );

-- bank_transactions
DROP POLICY IF EXISTS "bank_transactions_select_policy" ON public.bank_transactions;
CREATE POLICY "bank_transactions_select_policy" ON public.bank_transactions
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "bank_transactions_modify_policy" ON public.bank_transactions;
CREATE POLICY "bank_transactions_modify_policy" ON public.bank_transactions
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])
    );

-- company_tax_profile
DROP POLICY IF EXISTS "company_tax_profile_select_policy" ON public.company_tax_profile;
CREATE POLICY "company_tax_profile_select_policy" ON public.company_tax_profile
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "company_tax_profile_modify_policy" ON public.company_tax_profile;
CREATE POLICY "company_tax_profile_modify_policy" ON public.company_tax_profile
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
    );

-- tax_obligations
DROP POLICY IF EXISTS "tax_obligations_select_policy" ON public.tax_obligations;
CREATE POLICY "tax_obligations_select_policy" ON public.tax_obligations
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "tax_obligations_modify_policy" ON public.tax_obligations;
CREATE POLICY "tax_obligations_modify_policy" ON public.tax_obligations
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT'])
    );

-- tax_notifications
DROP POLICY IF EXISTS "tax_notifications_select_policy" ON public.tax_notifications;
CREATE POLICY "tax_notifications_select_policy" ON public.tax_notifications
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "tax_notifications_modify_policy" ON public.tax_notifications;
CREATE POLICY "tax_notifications_modify_policy" ON public.tax_notifications
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
    );

-- integration_connections
DROP POLICY IF EXISTS "integration_connections_select_policy" ON public.integration_connections;
CREATE POLICY "integration_connections_select_policy" ON public.integration_connections
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "integration_connections_modify_policy" ON public.integration_connections;
CREATE POLICY "integration_connections_modify_policy" ON public.integration_connections
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
    );

-- sync_logs
DROP POLICY IF EXISTS "sync_logs_select_policy" ON public.sync_logs;
CREATE POLICY "sync_logs_select_policy" ON public.sync_logs
    FOR SELECT USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
    );

DROP POLICY IF EXISTS "sync_logs_modify_policy" ON public.sync_logs;
CREATE POLICY "sync_logs_modify_policy" ON public.sync_logs
    FOR ALL USING (
        public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
    );

-- 12. SEED DEFAULT CATEGORIES AND TAX PROFILE FOR ALL EXISTING COMPANIES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, legal_name, tax_id FROM public.companies LOOP
        -- Seed Movement Categories
        INSERT INTO public.movement_categories (company_id, name, code, type, is_system) VALUES
            (r.id, 'Payroll & People', 'PAYROLL_PEOPLE', 'EXPENSE', true),
            (r.id, 'Software & Subscriptions', 'SOFTWARE_SUBSCRIPTIONS', 'EXPENSE', true),
            (r.id, 'Marketing & Advertising', 'MARKETING_ADVERTISING', 'EXPENSE', true),
            (r.id, 'Professional Services', 'PROFESSIONAL_SERVICES', 'EXPENSE', true),
            (r.id, 'Logistics', 'LOGISTICS', 'EXPENSE', true),
            (r.id, 'Inventory / COGS', 'INVENTORY_COGS', 'EXPENSE', true),
            (r.id, 'Taxes & Government', 'TAXES_GOVERNMENT', 'EXPENSE', true),
            (r.id, 'Banking & Financial Costs', 'BANKING_FINANCIAL_COSTS', 'EXPENSE', true),
            (r.id, 'Travel', 'TRAVEL', 'EXPENSE', true),
            (r.id, 'Utilities', 'UTILITIES', 'EXPENSE', true),
            (r.id, 'Office & Operations', 'OFFICE_OPERATIONS', 'EXPENSE', true),
            (r.id, 'Equipment', 'EQUIPMENT', 'EXPENSE', true),
            (r.id, 'Income / Sales', 'INCOME_SALES', 'INCOME', true),
            (r.id, 'Other Income', 'OTHER_INCOME', 'INCOME', true),
            (r.id, 'Other Expenses', 'OTHER_EXPENSES', 'EXPENSE', true)
        ON CONFLICT (company_id, code) DO NOTHING;

        -- Seed Default Company Tax Profile
        INSERT INTO public.company_tax_profile (
            company_id, tax_id, legal_name, country, city, municipality,
            tax_regime, rut_responsibilities, iva_responsible, income_tax_responsibility,
            withholding_agent, fiscal_year
        ) VALUES (
            r.id, r.tax_id, r.legal_name, 'Colombia', 'Medellín', 'Medellín',
            'RESPONSABLE_DE_IVA',
            ARRAY['05 - Impto sobre la renta y compl', '48 - Impuesto sobre las ventas - IVA']::TEXT[],
            true, true, false, 2026
        ) ON CONFLICT (company_id) DO NOTHING;

        -- Seed Default Integration Connection Placeholders
        INSERT INTO public.integration_connections (company_id, provider, category, name, status) VALUES
            (r.id, 'GOOGLE_DRIVE', 'DOCUMENT_STORAGE', 'Google Drive (Carpeta Contable)', 'NOT_CONFIGURED'),
            (r.id, 'BANCOLOMBIA', 'BANK', 'Bancolombia API Corporativa', 'NOT_CONFIGURED'),
            (r.id, 'STRIPE', 'PAYMENT_PLATFORM', 'Stripe Payments', 'NOT_CONFIGURED'),
            (r.id, 'PAYPAL', 'PAYMENT_PLATFORM', 'PayPal Business', 'NOT_CONFIGURED'),
            (r.id, 'MERCADO_PAGO', 'PAYMENT_PLATFORM', 'Mercado Pago Colombia', 'NOT_CONFIGURED'),
            (r.id, 'WOMPI', 'PAYMENT_PLATFORM', 'Wompi Bancolombia', 'NOT_CONFIGURED'),
            (r.id, 'AI_PROVIDER', 'AI', 'Motor Asesor IA Paguro', 'NOT_CONFIGURED'),
            (r.id, 'NOTIFICATIONS_EMAIL', 'NOTIFICATION', 'Servicio de Correo Transaccional', 'NOT_CONFIGURED')
        ON CONFLICT (company_id, provider) DO NOTHING;
    END LOOP;
END $$;
