# Paguro Finance - Financial Rules and Calculation Engine

## 1. Core Financial Principles

1. **Authoritative Calculation**:
   Financial totals must never be dictated or trusted from the client browser. Totals and balances are calculated and validated strictly by the server and PostgreSQL triggers.
2. **Immutable Financial History**:
   Destructive SQL `DELETE` operations are forbidden on finalized financial records (issued invoices, approved expenses, applied payments, inventory movements, closed tax periods). Adjustments must occur via `VOID`, `REVERSAL`, or compensatory documents with full audit trail logging.
3. **Decimal Representation**:
   Floating point numbers (`FLOAT`, `DOUBLE`, JavaScript native `Number` without rounding guards) are strictly prohibited for financial persistence. All database values use `NUMERIC(14, 2)`.

---

## 2. Invariant Formulas

### 2.1 Sales Invoices
For each line item $i \in \{1, \dots, n\}$:
$$
\text{line\_subtotal}_i = \text{round}\left(\text{quantity}_i \times \text{unit\_price}_i - \text{discount\_amount}_i, 2\right)
$$
$$
\text{line\_tax}_i = \text{round}\left(\text{line\_subtotal}_i \times \text{tax\_rate}_i, 2\right)
$$
$$
\text{line\_total}_i = \text{line\_subtotal}_i + \text{line\_tax}_i
$$

For the invoice header:
$$
\text{subtotal} = \sum_{i=1}^n \text{line\_subtotal}_i
$$
$$
\text{tax\_total} = \sum_{i=1}^n \text{line\_tax}_i
$$
$$
\text{discount\_total} = \sum_{i=1}^n \text{discount\_amount}_i
$$
$$
\text{total} = \text{subtotal} + \text{tax\_total}
$$
$$
\text{paid\_total} = \sum \text{allocated\_payments}
$$
$$
\text{balance\_due} = \text{total} - \text{paid\_total}
$$

### 2.2 Status Transitions (Sales Invoices)
- `draft`: Initial editable state.
- `issued`: Finalized and communicated to customer. `balance_due = total`.
- `partial`: At least one payment allocated ($0 < \text{paid\_total} < \text{total}$).
- `paid`: Outstanding balance fully settled ($\text{balance\_due} = 0$).
- `overdue`: $\text{balance\_due} > 0$ and $\text{due\_date} < \text{current\_date}$.
- `void`: Canceled before payment or reversed; excluded from revenue and KPI metrics.

### 2.3 Products & Inventory Synchronization
1. **Draft Invoices**:
   Draft invoices do NOT reserve, hold, or deduct inventory stock. Stock remains untouched while an invoice is in `draft`.
2. **Finalization / Issuance (`draft` -> `issued`)**:
   When an invoice is issued, the system checks stock availability for all physical tracked items. If sufficient, it inserts an authoritative `SALE` movement (`quantity_delta = -quantity`) with `source_type = 'sales_invoice'` and `source_id = invoice.id`.
3. **Idempotency**:
   The issuance routine verifies if movements with `source_type = 'sales_invoice'` and `source_id = invoice.id` already exist to prevent duplicate deductions upon retry.
4. **Void Reversal (`issued` -> `void`)**:
   When an issued invoice is voided, compensatory `RETURN_IN` movements (`quantity_delta = +abs(quantity)`) are created with `source_type = 'sales_invoice_void'` to restore physical stock balance.

### 2.4 Purchases & Expenses Document Lifecycle (Accounts Payable)
1. **Authoritative Foundation**:
   Physical purchases and operational expenses share the `purchase_documents` and `purchase_document_items` schema, with views `expenses` and `expense_items` reflecting the exact same data.
2. **External Vendor Reference**:
   Purchases track the vendor's bill number (`document_number`), guaranteed unique per supplier and company via composite constraint `UNIQUE(company_id, supplier_id, document_number)`.
3. **Calculation Invariants**:
   - Line subtotal: $\text{line\_subtotal} = \text{round}(\text{quantity} \times \text{unit\_price}, 2)$.
   - Line deductible tax: $\text{tax\_amount} = \text{round}(\text{line\_subtotal} \times \text{tax\_rate}, 2)$.
   - Document Subtotal: $\text{subtotal} = \sum \text{line\_subtotal}$.
   - Deductible Tax Total: $\text{deductible\_tax\_total} = \sum \text{tax\_amount}$.
   - Net Payable Total: $\text{total} = \max(0, \text{round}(\text{subtotal} + \text{deductible\_tax\_total} - \text{retention\_total}, 2))$.
   - Balance Due: $\text{balance\_due} = \text{total} - \text{paid\_total}$.
4. **Lifecycle State Machine**:
   - `draft`: Initial capture. Fully mutable by `SUPER_ADMIN`, `ADMIN`, `FINANCE`. No stock movement.
   - `open`: Approved / finalized. Lines locked. Generates `PURCHASE` inventory movements (`quantity_delta = +quantity`) for physical inventory items.
   - `partial`: Partial disbursement registered ($0 < \text{paid\_total} < \text{total}$).
   - `paid`: Outstanding balance fully settled ($\text{balance\_due} = 0$).
   - `void`: Annulled. Forbidden if $\text{paid\_total} > 0$. Reverses stock reception with compensatory `RETURN_OUT` movements (`quantity_delta = -quantity`).
5. **Accounts Payable Disbursements**:
   Disbursements are tracked via outbound `payments` linked through `payment_allocations` (`document_type = 'purchase_document'`). The trigger `trg_payment_allocation_sync` maintains `paid_total` and `balance_due`. Overpayment ($\text{amount} > \text{balance\_due}$) is rejected server-side.

---

## 3. Payments & Allocations Engine

1. **Independent Payment Ledger**:
   Payments are modeled as first-class entities (`payments`) rather than simple boolean switches.
2. **Allocation Invariants**:
   - For any payment $P$:
     $$
     \sum_{k} \text{allocation\_amount}_k \le P.\text{amount}
     $$
   - For any target document $D$ (invoice or purchase):
     $$
     \text{allocation\_amount} \le D.\text{balance\_due}
     $$
     (Overpayment on a document is rejected at the database trigger level unless explicitly authorized as credit balance).
3. **Atomic Balance Updates**:
   When a payment allocation is inserted or voided, a database trigger automatically:
   - Updates $D.\text{paid\_total} = D.\text{paid\_total} \pm \text{amount}$.
   - Updates $D.\text{balance\_due} = D.\text{total} - D.\text{paid\_total}$.
   - Recalculates document status (`partial` if balance > 0, `paid` if balance = 0).

---

## 4. Value Added Tax (IVA) Engine

1. **Generated Tax (IVA Generado)**:
   Calculated as the sum of all tax lines from valid, non-void `sales_invoices` with `issue_date` within the selected `tax_period`:
   $$
   \text{generated\_tax} = \sum_{\text{invoices}} \text{tax\_total}
   $$
2. **Deductible Tax (IVA Descontable)**:
   Calculated as the sum of all eligible deductible tax amounts from valid, non-void `purchase_documents` with `document_date` within the selected `tax_period`:
   $$
   \text{deductible\_tax} = \sum_{\text{purchases}} \text{deductible\_tax\_total}
   $$
3. **Net Tax Payable / Credit Balance**:
   $$
   \text{net\_tax} = \text{generated\_tax} - \text{deductible\_tax} + \sum \text{tax\_adjustments}
   $$
4. **Period Closing Lockdown**:
   Once a tax period status is set to `closed`:
   - No sales invoices or purchase documents can have dates falling into that period.
   - Any document previously in that period cannot be edited or voided.
   - To make corrections, an `ADMIN` must perform an explicit, audited `reopen` or register an adjustment document in the current open period.
