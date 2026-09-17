-- ============================================================================
-- Paguro Finance - Migration 00003: Row Level Security (RLS) Policies
-- Enforces multi-company isolation and role-based operational permissions
-- ============================================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. SECURITY HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_user_has_company_role(p_company_id UUID, p_allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.company_users
        WHERE company_id = p_company_id
          AND user_id = auth.uid()
          AND status = 'active'
          AND role = ANY(p_allowed_roles)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.company_users
        WHERE user_id = auth.uid()
          AND status = 'active'
          AND role = 'SUPER_ADMIN'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. POLICIES: COMPANIES
CREATE POLICY pol_companies_select ON companies
FOR SELECT USING (
    public.current_user_is_super_admin() OR
    id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid() AND status = 'active')
);

CREATE POLICY pol_companies_insert ON companies
FOR INSERT WITH CHECK (
    public.current_user_is_super_admin()
);

CREATE POLICY pol_companies_update ON companies
FOR UPDATE USING (
    public.current_user_is_super_admin() OR
    public.current_user_has_company_role(id, ARRAY['ADMIN'])
);

-- 4. POLICIES: PROFILES
CREATE POLICY pol_profiles_select ON profiles
FOR SELECT USING (
    id = auth.uid() OR
    public.current_user_is_super_admin() OR
    id IN (
        SELECT cu2.user_id 
        FROM company_users cu1
        JOIN company_users cu2 ON cu1.company_id = cu2.company_id
        WHERE cu1.user_id = auth.uid() AND cu1.status = 'active'
    )
);

CREATE POLICY pol_profiles_update ON profiles
FOR UPDATE USING (
    id = auth.uid()
);

-- 5. POLICIES: COMPANY_USERS
CREATE POLICY pol_company_users_select ON company_users
FOR SELECT USING (
    user_id = auth.uid() OR
    public.current_user_is_super_admin() OR
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN') AND status = 'active')
);

CREATE POLICY pol_company_users_write ON company_users
FOR ALL USING (
    public.current_user_is_super_admin() OR
    public.current_user_has_company_role(company_id, ARRAY['ADMIN'])
);

-- 6. POLICIES: CUSTOMERS & SUPPLIERS
CREATE POLICY pol_customers_select ON customers
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'])
);
CREATE POLICY pol_customers_write ON customers
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
);

CREATE POLICY pol_suppliers_select ON suppliers
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'])
);
CREATE POLICY pol_suppliers_write ON suppliers
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
);

-- 7. POLICIES: TAX RATES
CREATE POLICY pol_tax_rates_select ON tax_rates
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'])
);
CREATE POLICY pol_tax_rates_write ON tax_rates
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN'])
);

-- 8. POLICIES: PRODUCTS
CREATE POLICY pol_products_select ON products
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'])
);
CREATE POLICY pol_products_write ON products
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'])
);

-- 9. POLICIES: SALES INVOICES & ITEMS
CREATE POLICY pol_sales_invoices_select ON sales_invoices
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'])
);
CREATE POLICY pol_sales_invoices_write ON sales_invoices
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
);

CREATE POLICY pol_sales_invoice_items_select ON sales_invoice_items
FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales_invoices WHERE id = invoice_id AND public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER']))
);
CREATE POLICY pol_sales_invoice_items_write ON sales_invoice_items
FOR ALL USING (
    EXISTS (SELECT 1 FROM sales_invoices WHERE id = invoice_id AND public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE']))
);

-- 10. POLICIES: PURCHASE DOCUMENTS & ITEMS
CREATE POLICY pol_purchase_docs_select ON purchase_documents
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'VIEWER'])
);
CREATE POLICY pol_purchase_docs_write ON purchase_documents
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
);

CREATE POLICY pol_purchase_doc_items_select ON purchase_document_items
FOR SELECT USING (
    EXISTS (SELECT 1 FROM purchase_documents WHERE id = purchase_document_id AND public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'VIEWER']))
);
CREATE POLICY pol_purchase_doc_items_write ON purchase_document_items
FOR ALL USING (
    EXISTS (SELECT 1 FROM purchase_documents WHERE id = purchase_document_id AND public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE']))
);

-- 11. POLICIES: PAYMENTS & ALLOCATIONS
CREATE POLICY pol_payments_select ON payments
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'VIEWER'])
);
CREATE POLICY pol_payments_write ON payments
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
);

CREATE POLICY pol_payment_allocations_select ON payment_allocations
FOR SELECT USING (
    EXISTS (SELECT 1 FROM payments WHERE id = payment_id AND public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'VIEWER']))
);
CREATE POLICY pol_payment_allocations_write ON payment_allocations
FOR ALL USING (
    EXISTS (SELECT 1 FROM payments WHERE id = payment_id AND public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE']))
);

-- 12. POLICIES: INVENTORY MOVEMENTS
CREATE POLICY pol_inventory_select ON inventory_movements
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'])
);
CREATE POLICY pol_inventory_write ON inventory_movements
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'])
);

-- 13. POLICIES: TAX PERIODS & ADJUSTMENTS
CREATE POLICY pol_tax_periods_select ON tax_periods
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'VIEWER'])
);
CREATE POLICY pol_tax_periods_write ON tax_periods
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN'])
);

CREATE POLICY pol_tax_adjustments_select ON tax_adjustments
FOR SELECT USING (
    EXISTS (SELECT 1 FROM tax_periods WHERE id = tax_period_id AND public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'VIEWER']))
);
CREATE POLICY pol_tax_adjustments_write ON tax_adjustments
FOR ALL USING (
    EXISTS (SELECT 1 FROM tax_periods WHERE id = tax_period_id AND public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN']))
);

-- 14. POLICIES: DOCUMENTS
CREATE POLICY pol_documents_select ON documents
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'])
);
CREATE POLICY pol_documents_write ON documents
FOR ALL USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])
);

-- 15. POLICIES: AUDIT LOGS (IMMUTABLE)
CREATE POLICY pol_audit_logs_select ON audit_logs
FOR SELECT USING (
    public.current_user_has_company_role(company_id, ARRAY['SUPER_ADMIN', 'ADMIN'])
);
CREATE POLICY pol_audit_logs_insert ON audit_logs
FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
);
-- Note: NO UPDATE OR DELETE POLICY ON audit_logs
