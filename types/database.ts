// ============================================================================
// Paguro Finance - Database Schema TypeScript Interfaces
// Authoritative TypeScript typings reflecting PostgreSQL tables
// ============================================================================

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'ACCOUNTANT' | 'OPERATIONS' | 'VIEWER';
export type UserStatus = 'invited' | 'active' | 'suspended';

export interface Role {
  id: string;
  code: UserRole;
  name: string;
  description: string;
  is_system: boolean;
  created_at: string;
}

export interface PermissionRecord {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string;
  created_at: string;
}

export interface RolePermission {
  role_code: UserRole;
  permission_code: string;
}

export interface Company {
  id: string;
  legal_name: string;
  trade_name: string;
  tax_id: string;
  country_code: string;
  currency_code: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  status: UserStatus;
  invited_at: string;
  last_access_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyMember = CompanyUser;

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  legal_name?: string | null;
  identification_type: string;
  tax_id: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  city?: string | null;
  country: string;
  payment_terms_days: number;
  status: 'active' | 'inactive';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface CreateCustomerInput {
  name: string;
  legal_name?: string | null;
  identification_type: string;
  tax_id: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  city?: string | null;
  country?: string;
  payment_terms_days?: number;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

export interface UpdateCustomerInput {
  name?: string;
  legal_name?: string | null;
  identification_type?: string;
  tax_id?: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  city?: string | null;
  country?: string;
  payment_terms_days?: number;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  legal_name?: string | null;
  identification_type: string;
  tax_id: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  city?: string | null;
  country: string;
  payment_terms_days: number;
  status: 'active' | 'inactive';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface CreateSupplierInput {
  name: string;
  legal_name?: string | null;
  identification_type: string;
  tax_id: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  city?: string | null;
  country?: string;
  payment_terms_days?: number;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

export interface UpdateSupplierInput {
  name?: string;
  legal_name?: string | null;
  identification_type?: string;
  tax_id?: string;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  city?: string | null;
  country?: string;
  payment_terms_days?: number;
  notes?: string | null;
  status?: 'active' | 'inactive';
}

export interface TaxRate {
  id: string;
  company_id: string;
  code: string;
  name: string;
  rate: number; // e.g., 0.1900
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  product_type: 'physical' | 'service';
  supplier_id?: string | null;
  cost: number;
  sale_price: number;
  tax_rate_id: string;
  stock_minimum: number;
  is_inventory_item: boolean;
  status: 'active' | 'inactive' | 'archived';
  shopify_product_id?: string | null;
  shopify_variant_id?: string | null;
  barcode?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export type SalesInvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void';

export interface SalesInvoice {
  id: string;
  company_id: string;
  invoice_number: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  currency_code: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  paid_total: number;
  balance_due: number;
  status: SalesInvoiceStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface SalesInvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate_id: string;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
}

export type PurchaseDocumentStatus = 'draft' | 'open' | 'partial' | 'paid' | 'void';

export interface PurchaseDocument {
  id: string;
  company_id: string;
  document_number: string;
  supplier_id?: string | null;
  document_date: string;
  due_date: string;
  category: string;
  currency_code: string;
  subtotal: number;
  deductible_tax_total: number;
  retention_total: number;
  total: number;
  paid_total: number;
  balance_due: number;
  status: PurchaseDocumentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface PurchaseDocumentItem {
  id: string;
  purchase_document_id: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate_id?: string | null;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
}

export type PaymentDirection = 'inbound' | 'outbound';
export type PaymentStatus = 'completed' | 'void';

export interface Payment {
  id: string;
  company_id: string;
  direction: PaymentDirection;
  payment_date: string;
  amount: number;
  method: string;
  reference?: string | null;
  counterparty_type: 'customer' | 'supplier';
  counterparty_id: string;
  status: PaymentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  document_type: 'sales_invoice' | 'purchase_document';
  document_id: string;
  amount: number;
  created_at: string;
}

export type InventoryMovementType = 
  | 'PURCHASE' 
  | 'SALE' 
  | 'RETURN_IN' 
  | 'RETURN_OUT' 
  | 'ADJUSTMENT_IN' 
  | 'ADJUSTMENT_OUT' 
  | 'DAMAGED' 
  | 'TRANSFER_IN' 
  | 'TRANSFER_OUT';

export interface InventoryMovement {
  id: string;
  company_id: string;
  product_id: string;
  movement_type: InventoryMovementType;
  movement_date: string;
  quantity_delta: number;
  unit_cost: number;
  source_type?: string | null;
  source_id?: string | null;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type TaxPeriodStatus = 'open' | 'reviewed' | 'closed' | 'reopened';

export interface TaxPeriod {
  id: string;
  company_id: string;
  tax_type: string;
  period_start: string;
  period_end: string;
  generated_tax: number;
  deductible_tax: number;
  adjustments: number;
  net_tax: number;
  status: TaxPeriodStatus;
  closed_at?: string | null;
  closed_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxAdjustment {
  id: string;
  tax_period_id: string;
  adjustment_type: 'INCREASE_GENERATED' | 'DECREASE_GENERATED' | 'INCREASE_DEDUCTIBLE' | 'DECREASE_DEDUCTIBLE' | 'OTHER_CREDIT';
  amount: number;
  reason: string;
  document_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface DocumentAttachment {
  id: string;
  company_id: string;
  entity_type: string;
  entity_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  version: number;
  status: 'active' | 'replaced' | 'archived';
  uploaded_by?: string | null;
  uploaded_at: string;
}

export interface AuditLog {
  id: string;
  company_id?: string | null;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json?: Record<string, unknown> | null;
  after_json?: Record<string, unknown> | null;
  ip_or_context?: string | null;
  created_at: string;
}
