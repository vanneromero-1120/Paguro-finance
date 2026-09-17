-- ============================================================================
-- Paguro Finance - Migration 00002: Functions and Authoritative Triggers
-- Ensures financial consistency, derived balances, and closed-period freeze
-- ============================================================================

-- 1. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at to mutable tables
DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'companies', 'profiles', 'company_users', 'customers', 
        'suppliers', 'products', 'sales_invoices', 'purchase_documents', 
        'payments', 'tax_periods'
    ]) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;', tbl);
        EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();', tbl);
    END LOOP;
END $$;

-- 2. SALES INVOICE TOTAL RECALCULATION FUNCTION
CREATE OR REPLACE FUNCTION recalculate_sales_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_subtotal NUMERIC(14, 2);
    v_tax_total NUMERIC(14, 2);
    v_discount_total NUMERIC(14, 2);
    v_total NUMERIC(14, 2);
    v_paid_total NUMERIC(14, 2);
    v_balance_due NUMERIC(14, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_invoice_id := OLD.invoice_id;
    ELSE
        v_invoice_id := NEW.invoice_id;
    END IF;

    -- Aggregate line items
    SELECT 
        COALESCE(SUM(ROUND(quantity * unit_price - discount_amount, 2)), 0.00),
        COALESCE(SUM(tax_amount), 0.00),
        COALESCE(SUM(discount_amount), 0.00)
    INTO v_subtotal, v_tax_total, v_discount_total
    FROM sales_invoice_items
    WHERE invoice_id = v_invoice_id;

    v_total := v_subtotal + v_tax_total;

    -- Fetch current paid total
    SELECT paid_total INTO v_paid_total
    FROM sales_invoices
    WHERE id = v_invoice_id;

    v_paid_total := COALESCE(v_paid_total, 0.00);
    v_balance_due := GREATEST(0.00, v_total - v_paid_total);

    -- Update invoice header
    UPDATE sales_invoices
    SET subtotal = v_subtotal,
        tax_total = v_tax_total,
        discount_total = v_discount_total,
        total = v_total,
        balance_due = v_balance_due,
        status = CASE 
            WHEN status = 'void' THEN 'void'
            WHEN status = 'draft' THEN 'draft'
            WHEN v_balance_due = 0.00 AND v_total > 0 THEN 'paid'
            WHEN v_paid_total > 0.00 THEN 'partial'
            ELSE 'issued'
        END,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_sales_invoice_totals ON sales_invoice_items;
CREATE TRIGGER trg_recalc_sales_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON sales_invoice_items
FOR EACH ROW EXECUTE FUNCTION recalculate_sales_invoice_totals();

-- 3. PURCHASE DOCUMENT TOTAL RECALCULATION FUNCTION
CREATE OR REPLACE FUNCTION recalculate_purchase_document_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_doc_id UUID;
    v_subtotal NUMERIC(14, 2);
    v_tax_total NUMERIC(14, 2);
    v_total NUMERIC(14, 2);
    v_paid_total NUMERIC(14, 2);
    v_balance_due NUMERIC(14, 2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_doc_id := OLD.purchase_document_id;
    ELSE
        v_doc_id := NEW.purchase_document_id;
    END IF;

    SELECT 
        COALESCE(SUM(ROUND(quantity * unit_price, 2)), 0.00),
        COALESCE(SUM(tax_amount), 0.00)
    INTO v_subtotal, v_tax_total
    FROM purchase_document_items
    WHERE purchase_document_id = v_doc_id;

    v_total := v_subtotal + v_tax_total;

    SELECT paid_total INTO v_paid_total
    FROM purchase_documents
    WHERE id = v_doc_id;

    v_paid_total := COALESCE(v_paid_total, 0.00);
    v_balance_due := GREATEST(0.00, v_total - v_paid_total);

    UPDATE purchase_documents
    SET subtotal = v_subtotal,
        deductible_tax_total = v_tax_total,
        total = v_total,
        balance_due = v_balance_due,
        status = CASE 
            WHEN status = 'void' THEN 'void'
            WHEN status = 'draft' THEN 'draft'
            WHEN v_balance_due = 0.00 AND v_total > 0 THEN 'paid'
            WHEN v_paid_total > 0.00 THEN 'partial'
            ELSE 'open'
        END,
        updated_at = NOW()
    WHERE id = v_doc_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_purchase_document_totals ON purchase_document_items;
CREATE TRIGGER trg_recalc_purchase_document_totals
AFTER INSERT OR UPDATE OR DELETE ON purchase_document_items
FOR EACH ROW EXECUTE FUNCTION recalculate_purchase_document_totals();

-- 4. PAYMENT ALLOCATION & BALANCE SYNC
CREATE OR REPLACE FUNCTION process_payment_allocation_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_doc_type VARCHAR(30);
    v_doc_id UUID;
    v_amount_delta NUMERIC(14, 2);
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_doc_type := NEW.document_type;
        v_doc_id := NEW.document_id;
        v_amount_delta := NEW.amount;
    ELSIF TG_OP = 'DELETE' THEN
        v_doc_type := OLD.document_type;
        v_doc_id := OLD.document_id;
        v_amount_delta := -OLD.amount;
    ELSE
        -- TG_OP = 'UPDATE'
        v_doc_type := NEW.document_type;
        v_doc_id := NEW.document_id;
        v_amount_delta := NEW.amount - OLD.amount;
    END IF;

    IF v_doc_type = 'sales_invoice' THEN
        UPDATE sales_invoices
        SET paid_total = paid_total + v_amount_delta,
            balance_due = GREATEST(0.00, total - (paid_total + v_amount_delta)),
            status = CASE
                WHEN status = 'void' THEN 'void'
                WHEN (total - (paid_total + v_amount_delta)) <= 0.00 THEN 'paid'
                WHEN (paid_total + v_amount_delta) > 0.00 THEN 'partial'
                ELSE 'issued'
            END,
            updated_at = NOW()
        WHERE id = v_doc_id;
    ELSIF v_doc_type = 'purchase_document' THEN
        UPDATE purchase_documents
        SET paid_total = paid_total + v_amount_delta,
            balance_due = GREATEST(0.00, total - (paid_total + v_amount_delta)),
            status = CASE
                WHEN status = 'void' THEN 'void'
                WHEN (total - (paid_total + v_amount_delta)) <= 0.00 THEN 'paid'
                WHEN (paid_total + v_amount_delta) > 0.00 THEN 'partial'
                ELSE 'open'
            END,
            updated_at = NOW()
        WHERE id = v_doc_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_allocation_sync ON payment_allocations;
CREATE TRIGGER trg_payment_allocation_sync
AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
FOR EACH ROW EXECUTE FUNCTION process_payment_allocation_sync();

-- 5. CLOSED TAX PERIOD FREEZE TRIGGER
CREATE OR REPLACE FUNCTION prevent_closed_tax_period_modification()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
    v_doc_date DATE;
    v_period_exists BOOLEAN;
BEGIN
    IF TG_TABLE_NAME = 'sales_invoices' THEN
        IF TG_OP = 'DELETE' THEN
            v_company_id := OLD.company_id;
            v_doc_date := OLD.issue_date;
        ELSE
            v_company_id := NEW.company_id;
            v_doc_date := NEW.issue_date;
        END IF;
    ELSIF TG_TABLE_NAME = 'purchase_documents' THEN
        IF TG_OP = 'DELETE' THEN
            v_company_id := OLD.company_id;
            v_doc_date := OLD.document_date;
        ELSE
            v_company_id := NEW.company_id;
            v_doc_date := NEW.document_date;
        END IF;
    END IF;

    -- Check if a closed period covers this document's date
    SELECT EXISTS (
        SELECT 1
        FROM tax_periods
        WHERE company_id = v_company_id
          AND status = 'closed'
          AND v_doc_date BETWEEN period_start AND period_end
    ) INTO v_period_exists;

    IF v_period_exists THEN
        RAISE EXCEPTION 'Financial operation rejected: the date % falls within a closed tax period. Contact an Administrator to reopen.', v_doc_date;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_freeze_closed_period_sales ON sales_invoices;
CREATE TRIGGER trg_freeze_closed_period_sales
BEFORE INSERT OR UPDATE OR DELETE ON sales_invoices
FOR EACH ROW EXECUTE FUNCTION prevent_closed_tax_period_modification();

DROP TRIGGER IF EXISTS trg_freeze_closed_period_purchases ON purchase_documents;
CREATE TRIGGER trg_freeze_closed_period_purchases
BEFORE INSERT OR UPDATE OR DELETE ON purchase_documents
FOR EACH ROW EXECUTE FUNCTION prevent_closed_tax_period_modification();

-- 6. STOCK DERIVATION HELPER FUNCTION
CREATE OR REPLACE FUNCTION get_product_stock(p_product_id UUID)
RETURNS NUMERIC(12, 4) AS $$
DECLARE
    v_stock NUMERIC(12, 4);
BEGIN
    SELECT COALESCE(SUM(quantity_delta), 0.0000)
    INTO v_stock
    FROM inventory_movements
    WHERE product_id = p_product_id;

    RETURN v_stock;
END;
$$ LANGUAGE plpgsql STABLE;
