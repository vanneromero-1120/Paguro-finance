// ============================================================================
// Paguro Finance - Financial Domain Types & KPI Definitions
// ============================================================================

export interface DashboardKPIs {
  netSales: number;
  totalExpenses: number;
  accountsReceivable: number;
  accountsPayable: number;
  generatedVat: number;
  deductibleVat: number;
  estimatedVatPayable: number;
  inventoryValuation: number;
  lowStockCount: number;
  overdueInvoicesCount: number;
}

export interface InvoiceDraftInput {
  customerId: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  items: {
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRateId: string;
    taxRate: number;
  }[];
}

export interface ExpenseDraftInput {
  supplierId?: string;
  documentNumber: string;
  documentDate: string;
  dueDate: string;
  category: string;
  notes?: string;
  items: {
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRateId?: string;
    taxRate: number;
  }[];
}

export interface PaymentInput {
  direction: 'inbound' | 'outbound';
  paymentDate: string;
  amount: number;
  method: string;
  reference?: string;
  counterpartyType: 'customer' | 'supplier';
  counterpartyId: string;
  allocations: {
    documentType: 'sales_invoice' | 'purchase_document';
    documentId: string;
    amount: number;
  }[];
  notes?: string;
}

export interface InventoryMovementInput {
  productId: string;
  movementType: 'PURCHASE' | 'SALE' | 'RETURN_IN' | 'RETURN_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGED' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  quantityDelta: number;
  unitCost: number;
  reason?: string;
}

export interface FilterParams {
  companyId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  search?: string;
}
