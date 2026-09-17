# Paguro Finance - Roles and Permissions Matrix (RBAC)

## 1. Overview

Access control in **Paguro Finance** is strictly organized by company membership. A user's identity is authenticated globally via Supabase Auth, but their permissions are strictly bound to their active `company_id` membership in `company_users`.

A single user may have different roles across different companies (for example, `ADMIN` in Paguro Corp and `VIEWER` in Pagureo).

---

## 2. Standard Roles

| Role Code | Role Name | Scope & Purpose |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Super Administrador | Global system configuration, company creation, global parameters, unrestricted cross-company emergency audit access. Strictly restricted. |
| **`ADMIN`** | Administrador Financiero | Operational head of the company. Full CRUD on financial entities, period closing/reopening, manual tax adjustments, user invitations, and audit inspection. Cannot self-elevate or create Super Admins. |
| **`FINANCE`** | Finanzas y Operación | Creates and manages sales invoices, expenses, payments, reviews tax summaries, inspects inventory, views operational reports. Cannot close tax periods or manage users. |
| **`ACCOUNTANT`** | Contador / Revisor Fiscal | Focuses on fiscal compliance, tax periods (IVA/ICA), period closing, financial statements, and audit reviews. Prohibited from operational invoice/expense creation and user management. |
| **`OPERATIONS`** | Operaciones e Inventario | Manages product catalog and inventory movements (receptions, shipments, transfers, adjustments). Access to sales/expenses/taxes is restricted. |
| **`VIEWER`** | Consulta y Dirección | Read-only access to dashboards, reports, and approved documents. Cannot create, edit, or void any operational records. |

---

## 3. Permissions Matrix

| Feature / Action | `SUPER_ADMIN` | `ADMIN` | `FINANCE` | `ACCOUNTANT` | `OPERATIONS` | `VIEWER` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Executive Dashboard** | Full | Full | Full | Full (Fiscal) | Limited (Stock) | Read-only |
| **Sales Invoices - View** | Yes | Yes | Yes | Yes | Read-only | Read-only |
| **Sales Invoices - Create / Edit Draft**| Yes | Yes | Yes | No | No | No |
| **Sales Invoices - Issue / Finalize** | Yes | Yes | Yes | No | No | No |
| **Sales Invoices - Void (Anular)** | Yes | Yes | With Approval | No | No | No |
| **Customers - CRUD** | Yes | Yes | Yes | Read-only | Read-only | Read-only |
| **Purchases / Expenses - View** | Yes | Yes | Yes | Yes | No | Read-only |
| **Purchases / Expenses - Create / Edit** | Yes | Yes | Yes | No | No | No |
| **Purchases / Expenses - Void** | Yes | Yes | With Approval | No | No | No |
| **Suppliers - CRUD** | Yes | Yes | Yes | Read-only | Read-only | Read-only |
| **Payments - View Collections / Disb.** | Yes | Yes | Yes | Yes | No | Read-only |
| **Payments - Register Collections** | Yes | Yes | Yes | No | No | No |
| **Payments - Register Disbursements** | Yes | Yes | Yes | No | No | No |
| **Payments - Void / Reverse** | Yes | Yes | No | No | No | No |
| **Product Catalog - View** | Yes | Yes | Yes | Yes | Yes | Read-only |
| **Product Catalog - Create / Edit** | Yes | Yes | Read-only | No | Yes | No |
| **Inventory Movements - View Ledger** | Yes | Yes | Yes | Yes | Yes | Read-only |
| **Inventory Movements - Record Movement**| Yes | Yes | No | No | Yes | No |
| **Inventory Movements - Stock Adjustment**| Yes | Yes | No | No | Yes | No |
| **Taxes / IVA - View Summary** | Yes | Yes | Yes | Yes | No | Read-only |
| **Taxes / IVA - Manual Adjustments** | Yes | Yes | No | Yes | No | No |
| **Taxes / IVA - Close / Reopen Period**| Yes | Yes | No | Yes | No | No |
| **Financial Reports - View & Export** | Yes | Yes | Yes | Yes | Stock Only | Read-only |
| **Document Management - Upload** | Yes | Yes | Yes | Yes (Tax/Cert) | Yes | No |
| **Document Management - Download** | Yes | Yes | Yes | Yes | Allowed Only | Read-only |
| **User & Team Management** | Yes | Yes (Company only) | No | No | No | No |
| **Company Settings** | Yes | Yes | No | No | No | No |
| **Audit Logs - View** | Yes | Yes | Read-only (Own) | Yes | No | No |

---

## 4. Enforcement Layers

1. **Database Row Level Security (RLS)**:
   Every query to a tenant table automatically checks:
   `auth.uid() IN (SELECT user_id FROM company_users WHERE company_id = target.company_id AND status = 'active' AND role IN (allowed_roles))`
2. **Server Actions & API Routes**:
   Server actions validate `user.role` against required capabilities before executing business mutations.
3. **UI / Presentation Layer**:
   Components dynamically render or disable buttons, forms, and navigation menus based on the user's role in the active company.
