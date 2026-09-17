// ============================================================================
// Paguro Finance - RBAC Permission Checker
// ============================================================================

import { Permission } from '@/types/auth';
import { UserRole } from '@/types/database';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'view_dashboard',
    'view_invoices', 'create_invoices', 'edit_invoices', 'void_invoices',
    'view_expenses', 'create_expenses', 'edit_expenses', 'void_expenses',
    'view_payments', 'create_payments',
    'view_inventory', 'manage_inventory',
    'view_taxes', 'manage_taxes', 'close_taxes',
    'view_reports', 'export_reports',
    'manage_company', 'manage_users', 'view_audit_log',
  ],
  ADMIN: [
    'view_dashboard',
    'view_invoices', 'create_invoices', 'edit_invoices', 'void_invoices',
    'view_expenses', 'create_expenses', 'edit_expenses', 'void_expenses',
    'view_payments', 'create_payments',
    'view_inventory', 'manage_inventory',
    'view_taxes', 'manage_taxes', 'close_taxes',
    'view_reports', 'export_reports',
    'manage_company', 'manage_users', 'view_audit_log',
  ],
  FINANCE: [
    'view_dashboard',
    'view_invoices', 'create_invoices', 'edit_invoices',
    'view_expenses', 'create_expenses', 'edit_expenses',
    'view_payments', 'create_payments',
    'view_inventory',
    'view_taxes',
    'view_reports', 'export_reports',
    'view_audit_log',
  ],
  OPERATIONS: [
    'view_dashboard',
    'view_invoices',
    'view_inventory', 'manage_inventory',
    'view_reports',
  ],
  VIEWER: [
    'view_dashboard',
    'view_invoices',
    'view_expenses',
    'view_payments',
    'view_inventory',
    'view_taxes',
    'view_reports',
  ],
};

export function hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
