-- ============================================================================
-- Paguro Finance - Migration 00006: Sales Invoice Concurrency-Safe Numbering
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_next_sales_invoice_number(p_company_id UUID)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_year TEXT;
    v_prefix TEXT;
    v_last_num INTEGER;
    v_next_num INTEGER;
    v_invoice_number VARCHAR(50);
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_prefix := 'FAC-' || v_year || '-';

    -- Find current maximum sequence number for this company and year
    SELECT COALESCE(
        MAX(
            NULLIF(
                SUBSTRING(invoice_number FROM LENGTH(v_prefix) + 1),
                ''
            )::INTEGER
        ),
        0
    )
    INTO v_last_num
    FROM sales_invoices
    WHERE company_id = p_company_id
      AND invoice_number LIKE v_prefix || '%';

    v_next_num := v_last_num + 1;
    v_invoice_number := v_prefix || LPAD(v_next_num::TEXT, 5, '0');

    RETURN v_invoice_number;
END;
$function$;
