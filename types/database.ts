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
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateCompanyInput {
  legal_name?: string;
  trade_name?: string;
  tax_id?: string;
  country_code?: string;
  currency_code?: string;
  timezone?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}

export interface CompanyUserMembershipWithProfile {
  id: string;
  user_id: string;
  company_id: string;
  role: UserRole;
  status: 'active' | 'invited' | 'suspended';
  invited_at?: string | null;
  last_access_at?: string | null;
  profile: {
    id: string;
    email: string;
    full_name: string;
    phone?: string | null;
    avatar_url?: string | null;
  };
}

export interface AuditLogFilterInput {
  search?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
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

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  product_type: 'physical' | 'service';
  supplier_id?: string | null;
  cost: number;
  sale_price: number;
  tax_rate_id: string;
  stock_minimum?: number;
  is_inventory_item?: boolean;
  status?: 'active' | 'inactive' | 'archived';
  barcode?: string | null;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  product_type?: 'physical' | 'service';
  supplier_id?: string | null;
  cost?: number;
  sale_price?: number;
  tax_rate_id?: string;
  stock_minimum?: number;
  is_inventory_item?: boolean;
  status?: 'active' | 'inactive' | 'archived';
  barcode?: string | null;
}

export interface ProductWithStock extends Product {
  current_stock: number;
  inventory_value: number;
  tax_rate?: TaxRate | null;
  supplier?: Supplier | null;
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

export interface CreateInvoiceItemInput {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_rate_id: string;
  tax_rate?: number;
}

export interface CreateInvoiceInput {
  customer_id: string;
  issue_date: string;
  due_date: string;
  currency_code?: string;
  notes?: string | null;
  status?: 'draft' | 'issued';
  items: CreateInvoiceItemInput[];
}

export interface UpdateInvoiceInput {
  customer_id?: string;
  issue_date?: string;
  due_date?: string;
  currency_code?: string;
  notes?: string | null;
  items?: CreateInvoiceItemInput[];
}

export interface InvoiceWithCustomer extends SalesInvoice {
  customer?: Customer | null;
}

export interface InvoiceItemWithDetails extends SalesInvoiceItem {
  product?: Product | null;
  tax_rate_obj?: TaxRate | null;
}

export interface InvoiceWithDetails extends SalesInvoice {
  customer?: Customer | null;
  items: InvoiceItemWithDetails[];
  payments?: (PaymentAllocation & { payment: Payment })[];
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

export interface CreatePurchaseDocumentItemInput {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate_id?: string | null;
  tax_rate?: number;
}

export interface CreatePurchaseDocumentInput {
  document_number: string;
  supplier_id?: string | null;
  document_date: string;
  due_date: string;
  category: string;
  currency_code?: string;
  retention_total?: number;
  notes?: string | null;
  status?: 'draft' | 'open';
  items: CreatePurchaseDocumentItemInput[];
}

export interface UpdatePurchaseDocumentInput {
  document_number?: string;
  supplier_id?: string | null;
  document_date?: string;
  due_date?: string;
  category?: string;
  currency_code?: string;
  retention_total?: number;
  notes?: string | null;
  items?: CreatePurchaseDocumentItemInput[];
}

export interface PurchaseDocumentWithSupplier extends PurchaseDocument {
  supplier?: Supplier | null;
}

export interface PurchaseDocumentItemWithDetails extends PurchaseDocumentItem {
  product?: Product | null;
  tax_rate_obj?: TaxRate | null;
}

export interface PurchaseDocumentWithDetails extends PurchaseDocument {
  supplier?: Supplier | null;
  items: PurchaseDocumentItemWithDetails[];
  payments?: (PaymentAllocation & { payment: Payment })[];
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

export interface CreatePaymentInput {
  invoice_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference?: string | null;
  notes?: string | null;
}

export interface CreateSupplierPaymentInput {
  purchase_document_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference?: string | null;
  notes?: string | null;
}

export interface PaymentWithDetails extends Payment {
  counterparty?: Customer | Supplier | null;
  allocations?: (PaymentAllocation & {
    invoice?: SalesInvoice | null;
    purchase_document?: PurchaseDocument | null;
  })[];
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

export interface RecordMovementInput {
  product_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  unit_cost?: number;
  movement_date?: string;
  source_type?: string | null;
  source_id?: string | null;
  reason?: string | null;
}

export interface InventoryMovementWithDetails extends InventoryMovement {
  product?: {
    id: string;
    sku: string;
    name: string;
    category?: string | null;
    cost: number;
  } | null;
  created_by_profile?: {
    full_name: string;
    email: string;
  } | null;
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
  notes?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type TaxAdjustmentType =
  | 'INCREASE_GENERATED'
  | 'DECREASE_GENERATED'
  | 'INCREASE_DEDUCTIBLE'
  | 'DECREASE_DEDUCTIBLE'
  | 'OTHER_CREDIT';

export interface TaxAdjustment {
  id: string;
  tax_period_id: string;
  adjustment_type: TaxAdjustmentType;
  amount: number;
  reason: string;
  document_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface CreateTaxPeriodInput {
  tax_type?: string;
  period_start: string;
  period_end: string;
  notes?: string | null;
}

export interface CreateTaxAdjustmentInput {
  tax_period_id: string;
  adjustment_type: TaxAdjustmentType;
  amount: number;
  reason: string;
  document_id?: string | null;
}

export interface TaxSourceSalesItem {
  id: string;
  invoice_number: string;
  issue_date: string;
  customer_name: string;
  customer_tax_id?: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  status: string;
}

export interface TaxSourcePurchaseItem {
  id: string;
  document_number: string;
  document_date: string;
  supplier_name: string;
  supplier_tax_id?: string | null;
  category: string;
  subtotal: number;
  deductible_tax_total: number;
  total: number;
  status: string;
}

export interface TaxPeriodWithCalculations extends TaxPeriod {
  sales_count: number;
  sales_taxable_base: number;
  purchases_count: number;
  purchases_taxable_base: number;
  adjustments_list: TaxAdjustment[];
  sales_items?: TaxSourceSalesItem[];
  purchases_items?: TaxSourcePurchaseItem[];
}

export type DocumentEntityType =
  | 'sales_invoice'
  | 'purchase_document'
  | 'expense'
  | 'payment'
  | 'customer'
  | 'supplier'
  | 'tax_period';

export type DocumentStatus = 'active' | 'replaced' | 'archived';

export interface DocumentAttachment {
  id: string;
  company_id: string;
  entity_type: DocumentEntityType | string;
  entity_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  version: number;
  status: DocumentStatus;
  notes?: string | null;
  uploaded_by?: string | null;
  uploaded_at: string;
  // Enriched presentation fields
  uploader_name?: string | null;
  entity_label?: string | null;
  signed_url?: string | null;
}

export interface CreateDocumentInput {
  entity_type: DocumentEntityType;
  entity_id: string;
  notes?: string;
}

export interface DocumentFilterInput {
  entity_type?: string;
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface AttachableEntity {
  id: string;
  entity_type: DocumentEntityType;
  label: string;
  sublabel?: string;
  date?: string;
}

// ----------------------------------------------------------------------------
// Reports Types & Interfaces
// ----------------------------------------------------------------------------

export type ReportType =
  | 'sales'
  | 'expenses'
  | 'cxc'
  | 'cxp'
  | 'iva'
  | 'inventory'
  | 'customer_balances'
  | 'supplier_balances'
  | 'profitability';

export interface ReportFilterInput {
  company_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  customer_id?: string;
  supplier_id?: string;
  product_id?: string;
  tax_period_id?: string;
  category?: string;
  aging_bucket?: 'current' | '1_30' | '31_60' | '61_90' | '90_plus' | 'all';
}

export interface SalesReportItem {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_tax_id?: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  balance_due: number;
  status: string;
}

export interface SalesReportData {
  summary: {
    total_invoiced: number;
    total_subtotal: number;
    total_tax: number;
    total_collected: number;
    total_balance_due: number;
    invoice_count: number;
  };
  items: SalesReportItem[];
}

export interface ExpensesReportItem {
  id: string;
  document_number: string;
  supplier_name: string;
  supplier_tax_id?: string;
  category: string;
  document_date: string;
  due_date: string;
  subtotal: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  balance_due: number;
  status: string;
}

export interface ExpensesReportData {
  summary: {
    total_expenses: number;
    total_subtotal: number;
    total_tax: number;
    total_paid: number;
    total_balance_due: number;
    document_count: number;
  };
  items: ExpensesReportItem[];
  by_category: { category: string; total: number; count: number }[];
}

export interface AccountsReceivableItem {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_tax_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  days_overdue: number;
  aging_bucket: 'current' | '1_30' | '31_60' | '61_90' | '90_plus';
}

export interface AccountsReceivableReportData {
  summary: {
    total_receivable: number;
    current_amount: number;
    overdue_1_30: number;
    overdue_31_60: number;
    overdue_31_90?: number;
    overdue_61_90: number;
    overdue_90_plus: number;
    invoice_count: number;
  };
  items: AccountsReceivableItem[];
}

export interface AccountsPayableItem {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_tax_id: string;
  document_number: string;
  document_date: string;
  due_date: string;
  total: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  days_overdue: number;
  aging_bucket: 'current' | '1_30' | '31_60' | '61_90' | '90_plus';
}

export interface AccountsPayableReportData {
  summary: {
    total_payable: number;
    current_amount: number;
    overdue_1_30: number;
    overdue_31_60: number;
    overdue_61_90: number;
    overdue_90_plus: number;
    document_count: number;
  };
  items: AccountsPayableItem[];
}

export interface IvaReportItem {
  period_id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
  sales_vat: number;
  purchases_vat: number;
  adjustments_total: number;
  net_vat: number;
}

export interface IvaReportData {
  summary: {
    total_sales_vat: number;
    total_purchases_vat: number;
    total_adjustments: number;
    estimated_vat_payable: number;
  };
  items: IvaReportItem[];
}

export interface InventoryReportItem {
  id: string;
  sku: string;
  name: string;
  category_name?: string;
  current_stock: number;
  minimum_stock: number;
  unit_cost: number;
  unit_price: number;
  valuation: number;
  is_low_stock: boolean;
}

export interface InventoryReportData {
  summary: {
    total_skus: number;
    total_units: number;
    total_valuation: number;
    low_stock_count: number;
  };
  items: InventoryReportItem[];
}

export interface CustomerBalanceItem {
  customer_id: string;
  customer_name: string;
  customer_tax_id: string;
  total_invoiced: number;
  total_paid: number;
  current_balance: number;
  open_invoices_count: number;
}

export interface CustomerBalancesReportData {
  summary: {
    total_customers: number;
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
  };
  items: CustomerBalanceItem[];
}

export interface SupplierBalanceItem {
  supplier_id: string;
  supplier_name: string;
  supplier_tax_id: string;
  total_billed: number;
  total_paid: number;
  current_balance: number;
  open_bills_count: number;
}

export interface SupplierBalancesReportData {
  summary: {
    total_suppliers: number;
    total_billed: number;
    total_paid: number;
    total_outstanding: number;
  };
  items: SupplierBalanceItem[];
}

export interface ProductProfitabilityItem {
  product_id: string;
  sku: string;
  name: string;
  units_sold: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
}

export interface ProductProfitabilityReportData {
  summary: {
    total_units_sold: number;
    total_revenue: number;
    total_cogs: number;
    total_gross_profit: number;
    overall_margin_pct: number;
  };
  items: ProductProfitabilityItem[];
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

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export type DashboardPeriod = 'month' | 'quarter' | 'year';

export interface DashboardKpis {
  netSales: number;
  salesCount: number;
  totalExpenses: number;
  expensesCount: number;
  operatingMargin: number;
  operatingMarginPercent: number;
  accountsReceivable: number;
  openInvoicesCount: number;
  accountsPayable: number;
  openPurchasesCount: number;
  generatedVat: number;
  deductibleVat: number;
  estimatedVatPayable: number;
  inventoryValuation: number;
  trackedProductsCount: number;
  lowStockCount: number;
}

export interface DashboardRecentInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  customer_name: string;
  total: number;
  balance_due: number;
  status: SalesInvoiceStatus;
}

export interface DashboardRecentPurchase {
  id: string;
  document_number: string;
  issue_date: string;
  supplier_name: string;
  category: string;
  total: number;
  balance_due: number;
  status: PurchaseDocumentStatus;
}

export interface DashboardRecentPayment {
  id: string;
  payment_date: string;
  direction: PaymentDirection;
  method: string;
  reference?: string | null;
  amount: number;
  status: PaymentStatus;
  entity_name?: string | null;
}

export interface DashboardData {
  company: {
    id: string;
    trade_name: string;
    legal_name: string;
    tax_id: string;
    currency_code: string;
  };
  period: DashboardPeriod;
  date_from: string;
  date_to: string;
  kpis: DashboardKpis;
  recentSales: DashboardRecentInvoice[];
  recentPurchases: DashboardRecentPurchase[];
  recentPayments: DashboardRecentPayment[];
}

