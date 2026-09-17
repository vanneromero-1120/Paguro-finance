-- ============================================================================
-- Paguro Finance - Migration 00004: Safe Development Seed Data
-- Creates Paguro Corp Demo, Pagureo Demo, Pagurai Demo and realistic initial records
-- ============================================================================

-- 1. DEMO COMPANIES
INSERT INTO companies (id, legal_name, trade_name, tax_id, country_code, currency_code, timezone, is_active)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'Paguro Corp S.A.S.', 'Paguro Corp', '901.458.120-1', 'COL', 'COP', 'America/Bogota', TRUE),
    ('c2222222-2222-2222-2222-222222222222', 'Pagureo E-Commerce S.A.S.', 'Pagureo', '901.890.334-5', 'COL', 'COP', 'America/Bogota', TRUE),
    ('c3333333-3333-3333-3333-333333333333', 'Pagurai Artificial Intelligence S.A.S.', 'Pagurai', '901.992.871-9', 'COL', 'COP', 'America/Bogota', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. DEMO USER PROFILES
INSERT INTO profiles (id, email, full_name, is_active)
VALUES
    ('u1111111-1111-1111-1111-111111111111', 'admin@pagurocorp.com', 'Carlos Mendoza (Admin Paguro)', TRUE),
    ('u2222222-2222-2222-2222-222222222222', 'finance@pagurocorp.com', 'Valeria Rios (Finanzas Paguro)', TRUE),
    ('u3333333-3333-3333-3333-333333333333', 'ops@pagurocorp.com', 'Mateo Gómez (Operaciones)', TRUE),
    ('u4444444-4444-4444-4444-444444444444', 'viewer@pagurocorp.com', 'Sofia Herrera (Dirección)', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. COMPANY USER MEMBERSHIPS
INSERT INTO company_users (id, company_id, user_id, role, status)
VALUES
    ('cu111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'u1111111-1111-1111-1111-111111111111', 'ADMIN', 'active'),
    ('cu222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'u2222222-2222-2222-2222-222222222222', 'FINANCE', 'active'),
    ('cu333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'u3333333-3333-3333-3333-333333333333', 'OPERATIONS', 'active'),
    ('cu444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', 'u4444444-4444-4444-4444-444444444444', 'VIEWER', 'active'),
    -- Carlos Mendoza is also Admin in Pagureo
    ('cu555555-5555-5555-5555-555555555555', 'c2222222-2222-2222-2222-222222222222', 'u1111111-1111-1111-1111-111111111111', 'ADMIN', 'active')
ON CONFLICT (company_id, user_id) DO NOTHING;

-- 4. TAX RATES FOR PAGURO CORP
INSERT INTO tax_rates (id, company_id, code, name, rate, is_active)
VALUES
    ('t1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'IVA_19', 'IVA General 19%', 0.1900, TRUE),
    ('t2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'IVA_5', 'IVA Reducido 5%', 0.0500, TRUE),
    ('t3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'EXENTO', 'Exento de IVA 0%', 0.0000, TRUE)
ON CONFLICT (company_id, code) DO NOTHING;

-- 5. CUSTOMERS
INSERT INTO customers (id, company_id, name, legal_name, identification_type, tax_id, email, phone, city, payment_terms_days, status)
VALUES
    ('cust1111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Almacenes Éxito S.A.', 'Almacenes Éxito S.A.', 'NIT', '890.900.608-9', 'facturacion@exito.com', '+57 (4) 339-6565', 'Medellín', 30, 'active'),
    ('cust2222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Falabella de Colombia', 'Falabella de Colombia S.A.', 'NIT', '900.017.448-1', 'proveedores@falabella.com.co', '+57 (1) 587-8000', 'Bogotá', 45, 'active'),
    ('cust3333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'Rappi S.A.S.', 'Rappi S.A.S.', 'NIT', '900.843.801-0', 'accounting@rappi.com', '+57 (1) 316-0000', 'Bogotá', 15, 'active')
ON CONFLICT (company_id, tax_id) DO NOTHING;

-- 6. SUPPLIERS
INSERT INTO suppliers (id, company_id, name, legal_name, identification_type, tax_id, email, phone, city, payment_terms_days, status)
VALUES
    ('supp1111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Amazon Web Services Colombia', 'AWS Colombia S.A.S.', 'NIT', '901.324.912-3', 'billing@aws.amazon.com', '+1 206 266-1000', 'Bogotá', 30, 'active'),
    ('supp2222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Logística Express del Caribe', 'Logística Express del Caribe S.A.S.', 'NIT', '900.543.210-4', 'contacto@logisticaexpress.co', '+57 (5) 360-1234', 'Barranquilla', 15, 'active')
ON CONFLICT (company_id, tax_id) DO NOTHING;

-- 7. PRODUCTS
INSERT INTO products (id, company_id, sku, name, description, category, product_type, cost, sale_price, tax_rate_id, stock_minimum, is_inventory_item, status)
VALUES
    ('p1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'PAG-SW-001', 'Paguro Smart Tracker Pro', 'Dispositivo GPS y telemetría empresarial de alta precisión', 'Hardware', 'physical', 180000.00, 350000.00, 't1111111-1111-1111-1111-111111111111', 20.0000, TRUE, 'active'),
    ('p2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'PAG-ACC-002', 'Batería de Respaldo Litio 10k', 'Accesorio de batería industrial de larga duración', 'Accesorios', 'physical', 45000.00, 95000.00, 't1111111-1111-1111-1111-111111111111', 15.0000, TRUE, 'active'),
    ('p3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'PAG-SRV-003', 'Suscripción Plataforma Anual', 'Licencia anual de software SaaS Paguro Cloud', 'Servicios', 'service', 0.00, 480000.00, 't1111111-1111-1111-1111-111111111111', 0.0000, FALSE, 'active')
ON CONFLICT (company_id, sku) DO NOTHING;

-- 8. INITIAL INVENTORY MOVEMENTS
INSERT INTO inventory_movements (id, company_id, product_id, movement_type, movement_date, quantity_delta, unit_cost, source_type, reason, created_by)
VALUES
    ('im111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'PURCHASE', NOW() - INTERVAL '30 days', 100.0000, 180000.00, 'purchase_document', 'Lote de importación inicial', 'u1111111-1111-1111-1111-111111111111'),
    ('im222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'p2222222-2222-2222-2222-222222222222', 'PURCHASE', NOW() - INTERVAL '30 days', 50.0000, 45000.00, 'purchase_document', 'Stock inicial de accesorios', 'u1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- 9. SALES INVOICE
INSERT INTO sales_invoices (
    id, company_id, invoice_number, customer_id, issue_date, due_date, currency_code, 
    subtotal, tax_total, discount_total, total, paid_total, balance_due, status, notes, created_by
) VALUES (
    'inv11111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'FAC-2026-00001',
    'cust1111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days', 'COP',
    3500000.00, 665000.00, 0.00, 4165000.00, 2000000.00, 2165000.00, 'partial', 'Pedido corporativo Éxito Q3', 'u1111111-1111-1111-1111-111111111111'
) ON CONFLICT (company_id, invoice_number) DO NOTHING;

INSERT INTO sales_invoice_items (
    id, invoice_id, product_id, description, quantity, unit_price, discount_amount, tax_rate_id, tax_rate, tax_amount, line_total
) VALUES (
    'item1111-1111-1111-1111-111111111111', 'inv11111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111',
    'Paguro Smart Tracker Pro', 10.0000, 350000.00, 0.00, 't1111111-1111-1111-1111-111111111111', 0.1900, 665000.00, 4165000.00
) ON CONFLICT (id) DO NOTHING;

-- 10. PURCHASE DOCUMENT (EXPENSE)
INSERT INTO purchase_documents (
    id, company_id, document_number, supplier_id, document_date, due_date, category, currency_code,
    subtotal, deductible_tax_total, retention_total, total, paid_total, balance_due, status, notes, created_by
) VALUES (
    'pur11111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'AWS-INV-99482',
    'supp1111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 'OPERATING', 'COP',
    1200000.00, 228000.00, 0.00, 1428000.00, 1428000.00, 0.00, 'paid', 'Servicios de infraestructura AWS Cloud Agosto', 'u2222222-2222-2222-2222-222222222222'
) ON CONFLICT (company_id, supplier_id, document_number) DO NOTHING;

INSERT INTO purchase_document_items (
    id, purchase_document_id, product_id, description, quantity, unit_price, tax_rate_id, tax_rate, tax_amount, line_total
) VALUES (
    'pitem111-1111-1111-1111-111111111111', 'pur11111-1111-1111-1111-111111111111', NULL,
    'Servicios de cómputo en la nube AWS EC2 / RDS', 1.0000, 1200000.00, 't1111111-1111-1111-1111-111111111111', 0.1900, 228000.00, 1428000.00
) ON CONFLICT (id) DO NOTHING;

-- 11. PAYMENT
INSERT INTO payments (
    id, company_id, direction, payment_date, amount, method, reference, counterparty_type, counterparty_id, status, notes, created_by
) VALUES (
    'pay11111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'inbound',
    CURRENT_DATE - INTERVAL '3 days', 2000000.00, 'BANK_TRANSFER', 'TRANSF-BANCOLOMBIA-9921', 'customer', 'cust1111-1111-1111-1111-111111111111', 'completed', 'Anticipo 50% pedido Éxito', 'u2222222-2222-2222-2222-222222222222'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_allocations (
    id, payment_id, document_type, document_id, amount
) VALUES (
    'pa111111-1111-1111-1111-111111111111', 'pay11111-1111-1111-1111-111111111111', 'sales_invoice', 'inv11111-1111-1111-1111-111111111111', 2000000.00
) ON CONFLICT (id) DO NOTHING;

-- 12. TAX PERIOD (CURRENT BIMONTHLY)
INSERT INTO tax_periods (
    id, company_id, tax_type, period_start, period_end, generated_tax, deductible_tax, adjustments, net_tax, status
) VALUES (
    'tp111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'IVA',
    DATE_TRUNC('month', CURRENT_DATE)::DATE, (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 month' - INTERVAL '1 day')::DATE,
    665000.00, 228000.00, 0.00, 437000.00, 'open'
) ON CONFLICT (company_id, tax_type, period_start, period_end) DO NOTHING;
