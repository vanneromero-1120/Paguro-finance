-- ============================================================================
-- Paguro Finance - RLS Policy Reference Catalog
-- ============================================================================

-- Reference mapping of all Row Level Security policies per table and role.
-- For actual execution, see migration 00003_row_level_security.sql.

-- Summary of access permissions:
-- 1. SUPER_ADMIN: Can access any company and execute any query.
-- 2. ADMIN: Full operational rights within their active company_id. Can manage users, settings, and close tax periods.
-- 3. FINANCE: Can CRUD invoices, expenses, payments, and view tax summaries and inventory. Cannot close periods or manage users.
-- 4. OPERATIONS: Can CRUD products and inventory movements. View customers/suppliers. No access to financial expenses or taxes.
-- 5. VIEWER: Read-only access to dashboard, reports, and approved documents.

-- Tables with strict immutable append-only constraints:
-- - audit_logs: No UPDATE or DELETE policies exist.
