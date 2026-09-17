// ============================================================================
// Paguro Finance - Authentication & Session Context Types
// ============================================================================

import { Company, Profile, UserRole } from './database';

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
  companies: {
    company: Company;
    role: UserRole;
  }[];
  activeCompanyId: string;
  activeRole: UserRole;
}

export type Permission = 
  | 'view_dashboard'
  | 'view_invoices'
  | 'create_invoices'
  | 'edit_invoices'
  | 'void_invoices'
  | 'view_expenses'
  | 'create_expenses'
  | 'edit_expenses'
  | 'void_expenses'
  | 'view_payments'
  | 'create_payments'
  | 'view_inventory'
  | 'manage_inventory'
  | 'view_taxes'
  | 'manage_taxes'
  | 'close_taxes'
  | 'view_reports'
  | 'export_reports'
  | 'manage_company'
  | 'manage_users'
  | 'view_audit_log';
