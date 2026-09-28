// ============================================================================
// Paguro Finance V1 - Authoritative Financial Intelligence & Tax Types
// Multi-company isolated, strict TypeScript schema matching PostgreSQL 00010
// ============================================================================

export type MovementDirection = 'INCOME' | 'EXPENSE';

export type MovementSourceType =
  | 'GOOGLE_DRIVE'
  | 'BANK'
  | 'PAYMENT_PLATFORM'
  | 'ACCOUNTING_DOCUMENT'
  | 'MANUAL'
  | 'IMPORT'
  | 'SYSTEM';

export type DocumentProvenance =
  | 'USER_VERIFIED'
  | 'MANUAL_ENTRY'
  | 'VERIFIED_INTEGRATION'
  | 'AI_EXTRACTED'
  | 'RAW_DRIVE_DATA'
  | 'GOOGLE_DRIVE';

export type DocumentSourceStatus = 'ACTIVE' | 'SOURCE_MISSING' | 'REMOVED_FROM_DRIVE';

export interface SyncConflict {
  conflict_type: 'SOURCE_CHANGED_AFTER_VERIFICATION';
  detected_at: string;
  previous_values: Record<string, any>;
  new_extracted_values: Record<string, any>;
  changed_fields: string[];
  source_document: string;
  last_verified_at?: string | null;
  last_verified_by?: string | null;
}

export type MovementTaxRelevance = 'TAXABLE' | 'NON_TAXABLE' | 'EXEMPT' | 'EXCLUDED';
export type MovementTaxStatus = 'PENDING_MAPPING' | 'MAPPED_ESTIMATED' | 'VERIFIED';
export type MovementReviewStatus = 'CONFIRMED' | 'REQUIRES_REVIEW' | 'FLAGGED' | 'RESOLVED';

export interface MovementCategory {
  id: string;
  company_id: string;
  name: string;
  code?: string;
  type?: MovementDirection;
  direction?: MovementDirection | 'BOTH';
  parent_id?: string | null;
  default_tax_relevance?: MovementTaxRelevance;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  is_active?: boolean;
  is_system?: boolean;
  created_at: string;
  updated_at?: string;
  subcategories?: MovementCategory[];
}

export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'VIRTUAL_WALLET';
export type BankAccountStatus = 'ACTIVE' | 'INACTIVE' | 'SYNC_ERROR';

export interface BankAccount {
  id: string;
  company_id: string;
  institution: string;
  account_name: string;
  account_type: BankAccountType;
  masked_account_number: string;
  currency: string;
  integration_provider?: string | null;
  external_account_id?: string | null;
  status: BankAccountStatus;
  last_sync_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialMovement {
  id: string;
  company_id: string;
  movement_date: string;
  direction: MovementDirection;
  movement_type: string;
  source_type: MovementSourceType;
  source_id?: string | null;
  description: string;
  counterparty?: string | null;
  counterparty_tax_id?: string | null;
  original_amount: number;
  currency: string;
  exchange_rate: number;
  amount_cop: number;
  category_id?: string | null;
  subcategory_id?: string | null;
  payment_method?: string | null;
  bank_account_id?: string | null;
  tax_relevance: MovementTaxRelevance;
  tax_status: MovementTaxStatus;
  document_id?: string | null;
  external_reference?: string | null;
  confidence_score: number;
  review_status: MovementReviewStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined presentation fields
  category?: MovementCategory | null;
  bank_account?: BankAccount | null;
  document?: AccountingDocument | null;
  bank_transaction?: BankTransaction | null;
}

export type BankMatchStatus =
  | 'UNMATCHED'
  | 'SUGGESTED_MATCH'
  | 'MATCHED'
  | 'IGNORED'
  | 'REVIEW_REQUIRED';

export interface BankTransaction {
  id: string;
  company_id: string;
  bank_account_id: string;
  external_transaction_id?: string | null;
  posted_at: string;
  description: string;
  amount: number;
  currency: string;
  direction: 'INFLOW' | 'OUTFLOW';
  balance_after?: number | null;
  merchant?: string | null;
  counterparty?: string | null;
  reference?: string | null;
  raw_source?: Record<string, any>;
  match_status: BankMatchStatus;
  financial_movement_id?: string | null;
  confidence_score?: number | null;
  created_at: string;
  updated_at: string;

  bank_account?: BankAccount | null;
  financial_movement?: FinancialMovement | null;
}

export type DocumentPipelineStatus =
  | 'DISCOVERED'
  | 'ACCESSED'
  | 'CLASSIFIED'
  | 'EXTRACTED'
  | 'VALIDATED'
  | 'MATCHED'
  | 'REQUIRES_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED';

export type AccountingDocumentType =
  | 'ELECTRONIC_INVOICE'
  | 'COMMERCIAL_INVOICE'
  | 'SUPPLIER_INVOICE'
  | 'CUSTOMER_INVOICE'
  | 'SWIFT_CONFIRMATION'
  | 'PAYMENT_RECEIPT'
  | 'BANK_STATEMENT'
  | 'PACKING_LIST'
  | 'BILL_OF_LADING'
  | 'IMPORT_DOCUMENT'
  | 'TAX_DOCUMENT'
  | 'DIAN_REPORT'
  | 'OTHER_SUPPORT';

export interface AccountingDocument {
  id: string;
  company_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
  status: string;

  // V1 Drive Ingestion & AI Pipeline fields
  drive_file_id?: string | null;
  drive_folder_path?: string | null;
  drive_modified_time?: string | null;
  drive_version?: string | null;
  drive_md5_checksum?: string | null;
  last_synced_at?: string | null;
  source_status?: DocumentSourceStatus;
  provenance?: DocumentProvenance;
  user_verified_fields?: string[];
  verified_at?: string | null;
  verified_by?: string | null;
  conflict_details?: SyncConflict | null;
  document_type: AccountingDocumentType;
  source_url?: string | null;
  document_date?: string | null;
  counterparty_name?: string | null;
  counterparty_tax_id?: string | null;
  invoice_number?: string | null;
  currency: string;
  subtotal?: number | null;
  tax_iva?: number | null;
  tax_withholding?: number | null;
  tax_other?: number | null;
  total_amount?: number | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  due_date?: string | null;
  suggested_category_id?: string | null;
  confidence_score: number;
  pipeline_status: DocumentPipelineStatus;
  extracted_data?: Record<string, any>;
  financial_movement_id?: string | null;
  review_notes?: string | null;
}

export interface CompanyTaxProfile {
  id: string;
  company_id: string;
  tax_id: string;
  legal_name: string;
  country: string;
  city: string;
  municipality: string;
  tax_regime: string;
  rut_responsibilities: string[];
  iva_responsible: boolean;
  income_tax_responsibility: boolean;
  withholding_agent: boolean;
  ica_configuration: {
    rate: number;
    municipality: string;
    activity_code: string;
  };
  fiscal_year: number;
  accounting_contact?: string | null;
  tax_advisor_contact?: string | null;
  last_verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type TaxObligationStatus =
  | 'UPCOMING'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'PREPARED'
  | 'FILED'
  | 'PAID'
  | 'NOT_APPLICABLE';

export type TaxReviewStatus = 'ESTIMATED' | 'REVIEW_REQUIRED' | 'VERIFIED';

export interface TaxObligation {
  id: string;
  company_id: string;
  name: string;
  tax_type: string;
  period: string;
  due_date: string;
  estimated_amount: number;
  actual_amount?: number | null;
  status: TaxObligationStatus;
  source: string;
  confidence: number;
  review_status: TaxReviewStatus;
  notes?: string | null;
  evidence_document_id?: string | null;
  responsible_user?: string | null;
  filed_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;

  evidence_document?: AccountingDocument | null;
  days_remaining?: number;
}

export interface TaxNotification {
  id: string;
  company_id: string;
  tax_obligation_id: string;
  channel: 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'SLACK';
  trigger_type: 'DAYS_30' | 'DAYS_15' | 'DAYS_7' | 'DAYS_3' | 'DAYS_1' | 'DUE_DATE' | 'OVERDUE';
  scheduled_for: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DISMISSED';
  sent_at?: string | null;
  payload: Record<string, any>;
  created_at: string;

  tax_obligation?: TaxObligation | null;
}

export type IntegrationStatus =
  | 'CONNECTED'
  | 'NEEDS_ATTENTION'
  | 'DISCONNECTED'
  | 'NOT_CONFIGURED';

export interface GoogleDriveConnectionConfig {
  folder_id?: string;
  folder_name?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  token_type?: string;
  authorized_by?: string;
  auto_sync_enabled?: boolean;
  sync_interval_minutes?: number;
  next_scheduled_sync_at?: string | null;
  last_successful_sync_at?: string | null;
  start_page_token?: string;
  saved_page_token?: string;
  last_sync_stats?: {
    filesDiscovered: number;
    filesUpdated: number;
    filesRequiringReview: number;
    syncErrors: number;
    filesMissing: number;
  };
  [key: string]: any;
}

export interface IntegrationConnection {
  id: string;
  company_id: string;
  provider: string;
  category: string;
  name: string;
  status: IntegrationStatus;
  config: Record<string, any>;
  last_sync_at?: string | null;
  sync_status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  error_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  company_id: string;
  provider: string;
  sync_started_at: string;
  sync_finished_at?: string | null;
  records_found: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  error_summary?: string | null;
  created_at: string;
}

// AI Advisor Tools & Traceability Types
export type AiAdvisorTimeWindow =
  | '7D'
  | '30D'
  | 'CURRENT_MONTH'
  | 'PREVIOUS_MONTH'
  | 'CURRENT_QUARTER'
  | 'PREVIOUS_QUARTER'
  | '12M'
  | 'CURRENT_YEAR'
  | 'CUSTOM';

export interface AiCalculationTraceability {
  period_analyzed: string;
  date_from: string;
  date_to: string;
  transactions_count: number;
  categories_involved: string[];
  total_income: number;
  total_expense: number;
  net_flow: number;
  source_documents_count: number;
  calculation_basis: string;
  confidence_score: number;
  safety_disclaimer: string;
}

export interface AiAdvisorResponse {
  answer: string;
  summary_metrics?: {
    income: number;
    expenses: number;
    net_flow: number;
    estimated_tax: number;
  };
  traceability: AiCalculationTraceability;
  tools_invoked: string[];
  suggested_followups: string[];
}
