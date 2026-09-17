import { describe, it, expect } from 'vitest';
import { hasPermission } from '../lib/auth/permissions';

describe('RBAC Roles and Permissions Matrix', () => {
  it('SUPER_ADMIN and ADMIN should hold complete operational permissions', () => {
    expect(hasPermission('ADMIN', 'view_dashboard')).toBe(true);
    expect(hasPermission('ADMIN', 'create_invoices')).toBe(true);
    expect(hasPermission('ADMIN', 'void_invoices')).toBe(true);
    expect(hasPermission('ADMIN', 'create_expenses')).toBe(true);
    expect(hasPermission('ADMIN', 'close_taxes')).toBe(true);
    expect(hasPermission('ADMIN', 'manage_users')).toBe(true);
    expect(hasPermission('ADMIN', 'view_audit_log')).toBe(true);
  });

  it('FINANCE role can operate invoices, expenses, payments, but CANNOT close taxes or manage users', () => {
    expect(hasPermission('FINANCE', 'view_invoices')).toBe(true);
    expect(hasPermission('FINANCE', 'create_invoices')).toBe(true);
    expect(hasPermission('FINANCE', 'view_expenses')).toBe(true);
    expect(hasPermission('FINANCE', 'create_payments')).toBe(true);
    expect(hasPermission('FINANCE', 'view_taxes')).toBe(true);

    // Forbidden actions
    expect(hasPermission('FINANCE', 'close_taxes')).toBe(false);
    expect(hasPermission('FINANCE', 'manage_users')).toBe(false);
    expect(hasPermission('FINANCE', 'manage_company')).toBe(false);
  });

  it('OPERATIONS role can manage inventory and products, but CANNOT access expenses or taxes', () => {
    expect(hasPermission('OPERATIONS', 'manage_inventory')).toBe(true);
    expect(hasPermission('OPERATIONS', 'view_inventory')).toBe(true);

    // Forbidden
    expect(hasPermission('OPERATIONS', 'view_expenses')).toBe(false);
    expect(hasPermission('OPERATIONS', 'create_expenses')).toBe(false);
    expect(hasPermission('OPERATIONS', 'view_taxes')).toBe(false);
    expect(hasPermission('OPERATIONS', 'create_payments')).toBe(false);
  });

  it('VIEWER role is strictly read-only and cannot mutate any financial records', () => {
    expect(hasPermission('VIEWER', 'view_dashboard')).toBe(true);
    expect(hasPermission('VIEWER', 'view_invoices')).toBe(true);
    expect(hasPermission('VIEWER', 'view_reports')).toBe(true);

    // Prohibited mutations
    expect(hasPermission('VIEWER', 'create_invoices')).toBe(false);
    expect(hasPermission('VIEWER', 'create_expenses')).toBe(false);
    expect(hasPermission('VIEWER', 'create_payments')).toBe(false);
    expect(hasPermission('VIEWER', 'manage_inventory')).toBe(false);
  });
});
