-- ============================================================================
-- Paguro Finance - Modular Seed: Companies and Organizational Structure
-- ============================================================================

INSERT INTO companies (id, legal_name, trade_name, tax_id, country_code, currency_code, timezone, is_active)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'Paguro Corp S.A.S.', 'Paguro Corp', '901.458.120-1', 'COL', 'COP', 'America/Bogota', TRUE),
    ('c2222222-2222-2222-2222-222222222222', 'Pagureo E-Commerce S.A.S.', 'Pagureo', '901.890.334-5', 'COL', 'COP', 'America/Bogota', TRUE),
    ('c3333333-3333-3333-3333-333333333333', 'Pagurai Artificial Intelligence S.A.S.', 'Pagurai', '901.992.871-9', 'COL', 'COP', 'America/Bogota', TRUE)
ON CONFLICT (id) DO NOTHING;
