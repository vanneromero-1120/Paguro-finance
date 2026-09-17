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
     auth.has_company_access(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'])
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

### 2.3 Cross-Company Relational Integrity (Anti-Leakage Triggers)
Standard SQL foreign keys enforce record existence, but cannot verify cross-tenant boundaries (e.g. linking an invoice of Company A with a customer of Company B).
To enforce relational tenant boundaries at the PostgreSQL kernel level:
```sql
CREATE OR REPLACE FUNCTION validate_cross_company_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Customer cross-company validation on sales invoices
  IF TG_TABLE_NAME = 'sales_invoices' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.id = NEW.customer_id AND c.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'CROSS_COMPANY_VIOLATION: Customer % does not belong to company %', NEW.customer_id, NEW.company_id;
    END IF;
  END IF;

  -- Supplier cross-company validation on purchase documents
  IF TG_TABLE_NAME = 'purchase_documents' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.suppliers s 
      WHERE s.id = NEW.supplier_id AND s.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'CROSS_COMPANY_VIOLATION: Supplier % does not belong to company %', NEW.supplier_id, NEW.company_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2.4 Audit Logs Immutability
Audit logs are strictly append-only:
```sql
CREATE POLICY audit_select_policy ON audit_logs
FOR SELECT USING (
  auth.has_company_access(company_id, ARRAY['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'])
);

CREATE POLICY audit_insert_policy ON audit_logs
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Note: NO UPDATE or DELETE policy is defined on audit_logs, ensuring true immutability.
```

---

## 3. Storage Security (Private Buckets)

- **Bucket**: `financial-documents`
- **Public Access**: `FALSE` (Strictly disabled)
- **Path Convention**: `{company_id}/{entity_type}/{entity_id}/{timestamp}_{sanitized_filename}`
- **Supported Entity Types**: `invoices`, `expenses`, `payments`, `customers`, `suppliers`, `tax_periods`.
- **Storage RLS Policy**: Users can only upload and read documents located in folders matching `(storage.foldername(name))[1] = company_id` for companies where they hold an active membership.
- **Access Protocol**: Time-limited HMAC-signed URLs generated via `createSignedUrl` with default TTL of 300 seconds (5 minutes). Permanent public URLs are prohibited.

---

## 4. Next.js Session & Middleware Route Protection

- **Root Middleware (`middleware.ts`)**: Invokes `@supabase/ssr` to validate user session tokens via `supabase.auth.getUser()`.
- **Protected Paths**: `/dashboard`, `/sales/*`, `/purchases/*`, `/inventory/*`, `/taxes/*`, `/reports/*`, `/documents/*`, `/settings/*`.
- **Interception**: Unauthenticated access triggers immediate redirection to `/login?returnTo=[target]`.
- **403 Boundary**: Insufficient roles or non-existent company memberships route users to the `/unauthorized` explanation screen with tenant switching options.

