# Paguro Finance - Security Architecture & RLS Specification

## 1. Security Principles

1. **Defense-in-Depth**:
   Security is enforced across three distinct barriers:
   - **Frontend**: Context-aware UI controls, route guards, and active company context.
   - **Backend**: Server Actions and API middleware validating user identity, active company membership, and role authorization.
   - **Database (authoritative)**: PostgreSQL Row Level Security (RLS) policies and trigger constraints preventing unauthorized access even if the application layer is bypassed.
2. **Multi-Tenant Isolation**:
   No user can ever query, insert, modify, or delete records belonging to a company where they do not possess an `active` membership in `company_users`.
3. **No Secret Leaks**:
   Supabase `service_role` keys are strictly forbidden in client-side bundles. Only `anon_key` with authenticated JWTs is exposed to the browser.

---

## 2. Row Level Security (RLS) Implementation

Every table in the database has RLS enabled via `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`.

### 2.1 Core Helper Functions
```sql
-- Helper to verify active company membership
CREATE OR REPLACE FUNCTION auth.user_company_role(p_company_id UUID)
RETURNS VARCHAR AS $$
  SELECT role
  FROM public.company_users
  WHERE company_id = p_company_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper to verify if user has any of the authorized roles in the target company
CREATE OR REPLACE FUNCTION auth.has_company_access(p_company_id UUID, p_allowed_roles VARCHAR[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role = ANY(p_allowed_roles)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 2.2 Standard Tenant Policies
For all operational tables (`sales_invoices`, `purchase_documents`, `customers`, `suppliers`, `products`, `inventory_movements`, `payments`, `tax_periods`):

1. **SELECT Policy**:
   ```sql
   CREATE POLICY tenant_select_policy ON sales_invoices
   FOR SELECT USING (
     auth.has_company_access(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'VIEWER'])
   );
   ```
2. **INSERT Policy**:
   ```sql
   CREATE POLICY tenant_insert_policy ON sales_invoices
   FOR INSERT WITH CHECK (
     auth.has_company_access(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
   );
   ```
3. **UPDATE Policy**:
   ```sql
   CREATE POLICY tenant_update_policy ON sales_invoices
   FOR UPDATE USING (
     auth.has_company_access(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
   );
   ```
4. **DELETE Policy**:
   ```sql
   CREATE POLICY tenant_delete_policy ON sales_invoices
   FOR DELETE USING (
     -- Only drafts may be deleted by ADMIN or SUPER_ADMIN
     status = 'draft' AND auth.has_company_access(company_id, ARRAY['SUPER_ADMIN', 'ADMIN'])
   );
   ```

### 2.3 Audit Logs Immutability
Audit logs are append-only:
```sql
CREATE POLICY audit_select_policy ON audit_logs
FOR SELECT USING (
  auth.has_company_access(company_id, ARRAY['SUPER_ADMIN', 'ADMIN'])
);

CREATE POLICY audit_insert_policy ON audit_logs
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Note: NO UPDATE or DELETE policy is defined on audit_logs, ensuring true immutability.
```

---

## 3. Storage Security (Private Buckets)

- Bucket: `financial-documents`
- Public access: `FALSE`
- Storage RLS Policy: Users can only upload and read documents located in folders matching `(storage.foldername(name))[1] = company_id` for companies where they hold an active membership.
- Previews and downloads are delivered using short-lived signed URLs (expiry: 15 minutes).
