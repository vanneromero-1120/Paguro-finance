-- ============================================================================
-- Paguro Finance - Migration 00008: Documents Metadata & Storage Policies
-- ============================================================================

-- 1. Add notes column to documents if not exists
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Update validate_cross_company_integrity function to support documents
CREATE OR REPLACE FUNCTION public.validate_cross_company_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_owner_company_id UUID;
BEGIN
    -- 1. Sales Invoices: customer must belong to same company
    IF TG_TABLE_NAME = 'sales_invoices' THEN
        SELECT company_id INTO v_owner_company_id FROM customers WHERE id = NEW.customer_id;
        IF v_owner_company_id != NEW.company_id THEN
            RAISE EXCEPTION 'Cross-company violation: Customer % does not belong to company %', NEW.customer_id, NEW.company_id;
        END IF;

    -- 2. Purchase Documents: supplier must belong to same company
    ELSIF TG_TABLE_NAME = 'purchase_documents' THEN
        IF NEW.supplier_id IS NOT NULL THEN
            SELECT company_id INTO v_owner_company_id FROM suppliers WHERE id = NEW.supplier_id;
            IF v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Supplier % does not belong to company %', NEW.supplier_id, NEW.company_id;
            END IF;
        END IF;

    -- 3. Sales Invoice Items: product must belong to invoice company
    ELSIF TG_TABLE_NAME = 'sales_invoice_items' THEN
        IF NEW.product_id IS NOT NULL THEN
            SELECT i.company_id INTO v_owner_company_id FROM sales_invoices i WHERE i.id = NEW.invoice_id;
            IF NOT EXISTS (SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.company_id = v_owner_company_id) THEN
                RAISE EXCEPTION 'Cross-company violation: Product % does not belong to invoice company %', NEW.product_id, v_owner_company_id;
            END IF;
        END IF;

    -- 4. Products: supplier and tax_rate must belong to product company
    ELSIF TG_TABLE_NAME = 'products' THEN
        IF NEW.supplier_id IS NOT NULL THEN
            SELECT company_id INTO v_owner_company_id FROM suppliers WHERE id = NEW.supplier_id;
            IF v_owner_company_id IS NOT NULL AND v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Supplier % does not belong to product company %', NEW.supplier_id, NEW.company_id;
            END IF;
        END IF;

        IF NEW.tax_rate_id IS NOT NULL THEN
            SELECT company_id INTO v_owner_company_id FROM tax_rates WHERE id = NEW.tax_rate_id;
            IF v_owner_company_id IS NOT NULL AND v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Tax rate % does not belong to product company %', NEW.tax_rate_id, NEW.company_id;
            END IF;
        END IF;

    -- 5. Inventory Movements: product must belong to movement company
    ELSIF TG_TABLE_NAME = 'inventory_movements' THEN
        SELECT company_id INTO v_owner_company_id FROM products WHERE id = NEW.product_id;
        IF v_owner_company_id != NEW.company_id THEN
            RAISE EXCEPTION 'Cross-company violation: Product % does not belong to movement company %', NEW.product_id, NEW.company_id;
        END IF;

    -- 6. Payments: counterparty must belong to payment company
    ELSIF TG_TABLE_NAME = 'payments' THEN
        IF NEW.counterparty_type = 'customer' THEN
            SELECT company_id INTO v_owner_company_id FROM customers WHERE id = NEW.counterparty_id;
            IF v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Customer counterparty % does not belong to payment company %', NEW.counterparty_id, NEW.company_id;
            END IF;
        ELSIF NEW.counterparty_type = 'supplier' THEN
            SELECT company_id INTO v_owner_company_id FROM suppliers WHERE id = NEW.counterparty_id;
            IF v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Supplier counterparty % does not belong to payment company %', NEW.counterparty_id, NEW.company_id;
            END IF;
        END IF;

    -- 7. Purchase Document Items: product must belong to purchase document company
    ELSIF TG_TABLE_NAME = 'purchase_document_items' THEN
        IF NEW.product_id IS NOT NULL THEN
            SELECT pdoc.company_id INTO v_owner_company_id FROM purchase_documents pdoc WHERE pdoc.id = NEW.purchase_document_id;
            IF NOT EXISTS (SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.company_id = v_owner_company_id) THEN
                RAISE EXCEPTION 'Cross-company violation: Product % does not belong to purchase document company %', NEW.product_id, v_owner_company_id;
            END IF;
        END IF;

    -- 8. Payment Allocations: invoice/purchase document must belong to payment company
    ELSIF TG_TABLE_NAME = 'payment_allocations' THEN
        SELECT p.company_id INTO v_owner_company_id FROM payments p WHERE p.id = NEW.payment_id;
        IF NEW.document_type = 'sales_invoice' THEN
            IF NOT EXISTS (SELECT 1 FROM sales_invoices inv WHERE inv.id = NEW.document_id AND inv.company_id = v_owner_company_id) THEN
                RAISE EXCEPTION 'Cross-company violation: Invoice % does not belong to payment company %', NEW.document_id, v_owner_company_id;
            END IF;
        ELSIF NEW.document_type = 'purchase_document' THEN
            IF NOT EXISTS (SELECT 1 FROM purchase_documents pdoc WHERE pdoc.id = NEW.document_id AND pdoc.company_id = v_owner_company_id) THEN
                RAISE EXCEPTION 'Cross-company violation: Purchase document % does not belong to payment company %', NEW.document_id, v_owner_company_id;
            END IF;
        END IF;

    -- 9. Documents: target entity must belong to same company
    ELSIF TG_TABLE_NAME = 'documents' THEN
        IF NEW.entity_type = 'sales_invoice' THEN
            SELECT company_id INTO v_owner_company_id FROM sales_invoices WHERE id = NEW.entity_id;
            IF v_owner_company_id IS NOT NULL AND v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Sales invoice % does not belong to document company %', NEW.entity_id, NEW.company_id;
            END IF;
        ELSIF NEW.entity_type IN ('purchase_document', 'expense') THEN
            SELECT company_id INTO v_owner_company_id FROM purchase_documents WHERE id = NEW.entity_id;
            IF v_owner_company_id IS NOT NULL AND v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Purchase document % does not belong to document company %', NEW.entity_id, NEW.company_id;
            END IF;
        ELSIF NEW.entity_type = 'payment' THEN
            SELECT company_id INTO v_owner_company_id FROM payments WHERE id = NEW.entity_id;
            IF v_owner_company_id IS NOT NULL AND v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Payment % does not belong to document company %', NEW.entity_id, NEW.company_id;
            END IF;
        ELSIF NEW.entity_type = 'customer' THEN
            SELECT company_id INTO v_owner_company_id FROM customers WHERE id = NEW.entity_id;
            IF v_owner_company_id IS NOT NULL AND v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Customer % does not belong to document company %', NEW.entity_id, NEW.company_id;
            END IF;
        ELSIF NEW.entity_type = 'supplier' THEN
            SELECT company_id INTO v_owner_company_id FROM suppliers WHERE id = NEW.entity_id;
            IF v_owner_company_id IS NOT NULL AND v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Supplier % does not belong to document company %', NEW.entity_id, NEW.company_id;
            END IF;
        ELSIF NEW.entity_type = 'tax_period' THEN
            SELECT company_id INTO v_owner_company_id FROM tax_periods WHERE id = NEW.entity_id;
            IF v_owner_company_id IS NOT NULL AND v_owner_company_id != NEW.company_id THEN
                RAISE EXCEPTION 'Cross-company violation: Tax period % does not belong to document company %', NEW.entity_id, NEW.company_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- 3. Attach cross-company trigger to documents
DROP TRIGGER IF EXISTS trg_val_cross_company_documents ON documents;
CREATE TRIGGER trg_val_cross_company_documents
    BEFORE INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION validate_cross_company_integrity();

-- 4. Enable Storage RLS Policies for financial-documents bucket
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        DROP POLICY IF EXISTS pol_storage_financial_docs_select ON storage.objects;
        CREATE POLICY pol_storage_financial_docs_select ON storage.objects
        FOR SELECT TO authenticated
        USING (
            bucket_id = 'financial-documents'
            AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND public.current_user_has_company_role(
                ((storage.foldername(name))[1])::uuid,
                ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER']
            )
        );

        DROP POLICY IF EXISTS pol_storage_financial_docs_insert ON storage.objects;
        CREATE POLICY pol_storage_financial_docs_insert ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'financial-documents'
            AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND public.current_user_has_company_role(
                ((storage.foldername(name))[1])::uuid,
                ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS']
            )
        );

        DROP POLICY IF EXISTS pol_storage_financial_docs_delete ON storage.objects;
        CREATE POLICY pol_storage_financial_docs_delete ON storage.objects
        FOR DELETE TO authenticated
        USING (
            bucket_id = 'financial-documents'
            AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND public.current_user_has_company_role(
                ((storage.foldername(name))[1])::uuid,
                ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS']
            )
        );
    END IF;
END $$;
