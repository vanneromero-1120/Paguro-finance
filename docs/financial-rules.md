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

> [!IMPORTANT]
> **Operational Control Disclaimer**: Paguro Finance provides operational tax calculations and period tracking based on real transaction data. It is NOT an official tax filing system (DIAN) and does not replace the certified review and submission of tax forms by a licensed accountant or tax auditor.

1. **Generated Tax (IVA Generado - Ventas)**:
   Calculated from finalized sales invoices (`status IN ('issued', 'partial', 'paid')`) with `issue_date` within the tax period date range ($[\text{period\_start}, \text{period\_end}]$):
   $$
   \text{generated\_tax} = \sum_{\text{eligible invoices}} \text{tax\_total}
   $$
   Draft and void invoices are strictly excluded from generated tax.

2. **Deductible Tax (IVA Descontable - Compras)**:
   Calculated from approved purchase documents and expenses (`status IN ('open', 'partial', 'paid')`) with `document_date` within the tax period date range ($[\text{period\_start}, \text{period\_end}]$):
   $$
   \text{deductible\_tax} = \sum_{\text{eligible purchases}} \text{deductible\_tax\_total}
   $$
   Draft and void purchases are strictly excluded from deductible tax.

3. **Signed Manual Adjustments**:
   Manual adjustments are tracked in `tax_adjustments` with strict audit logging:
   - Debit adjustments (`INCREASE_GENERATED`, `DECREASE_DEDUCTIBLE`): $\Delta > 0$ (increase net tax payable).
   - Credit adjustments (`DECREASE_GENERATED`, `INCREASE_DEDUCTIBLE`, `OTHER_CREDIT`): $\Delta < 0$ (decrease net tax payable).
   $$
   \text{adjustments} = \sum \Delta_k
   $$

4. **Estimated Net Tax Formulation**:
   $$
   \text{net\_tax} = \text{generated\_tax} - \text{deductible\_tax} + \text{adjustments}
   $$
   - If $\text{net\_tax} \ge 0$: Estimated tax payable to the tax authority.
   - If $\text{net\_tax} < 0$: Accumulated tax credit / Saldo a favor.

5. **Period Locking & Mutation Lockdown**:
   - Statuses: `'open'` $\rightarrow$ `'reviewed'` $\rightarrow$ `'closed'` $\rightarrow$ `'reopened'`.
   - When a tax period is `'closed'`, the database trigger `prevent_closed_tax_period_modification` immediately blocks inserting, modifying, or deleting sales invoices or purchase documents whose dates fall within that period.
   - Adjustments cannot be added to a `'closed'` period without an explicit administrative reopen action.
   - Reopening a closed period requires `SUPER_ADMIN`, `ADMIN`, or `ACCOUNTANT` role and generates an immutable record in `audit_logs`.

---

## 5. Financial Reporting & Aging Rules

### 5.1 Accounts Receivable (A/R) & Accounts Payable (A/P) Aging

Aging is calculated server-side based on the calendar day difference between the query reference date ($T_{\text{as\_of}}$, default UTC today) and the document's contractual due date ($T_{\text{due}}$):

$$
\text{days\_overdue} = \lfloor \frac{T_{\text{as\_of}} - T_{\text{due}}}{86,400,000 \text{ ms}} \rfloor
$$

Standard aging classification buckets:
- **Current (Al Día)**: $\text{days\_overdue} \le 0$ (document is not yet due).
- **1 to 30 Days**: $1 \le \text{days\_overdue} \le 30$.
- **31 to 60 Days**: $31 \le \text{days\_overdue} \le 60$.
- **61 to 90 Days**: $61 \le \text{days\_overdue} \le 90$.
- **90+ Days**: $\text{days\_overdue} > 90$.

Aging aggregations strictly apply to open balances:
$$
\text{balance\_due} = \max(0, \text{total} - \text{paid\_amount})
$$
Fully paid documents ($\text{balance\_due} = 0$) are excluded from aging summary metrics.

### 5.2 Inventory Valuation

1. **Current Stock derivation**: Current stock is never stored as an arbitrary mutable counter; it is derived by summing all historical inventory movements:
   $$
   \text{current\_stock} = \sum \text{quantity\_delta}_i
   $$
2. **Valuation**: Total asset value of on-hand inventory is computed using unit cost price:
   $$
   \text{valuation} = \text{round}(\max(0, \text{current\_stock}) \times \text{cost\_price}, 2)
   $$
3. **Low Stock Threshold**: Flagged when $\text{current\_stock} \le \text{min\_stock}$.

### 5.3 Product Profitability Formulation

Profitability is computed from issued, partial, and paid sales invoices:
1. **Net Revenue**: $\text{revenue} = \sum (\text{quantity} \times \text{unit\_price} - \text{discount})$.
2. **Cost of Goods Sold (COGS)**: $\text{cogs} = \sum (\text{quantity} \times \text{product.cost\_price})$.
3. **Gross Profit**: $\text{gross\_profit} = \text{revenue} - \text{cogs}$.
4. **Gross Margin Percentage**:
   $$
   \text{gross\_margin\_pct} = \begin{cases}
   \text{round}((\frac{\text{gross\_profit}}{\text{revenue}}) \times 100, 2) & \text{if } \text{revenue} > 0 \\
   0 & \text{otherwise}
   \end{cases}
   $$

### 5.4 Export Security & Compliance

- All export routines must enforce multi-tenant company isolation; cross-company data leakage is structurally impossible at both RLS and server action layers.
- Export operations generate an immutable record in `audit_logs` (`action = 'REPORT_EXPORT'`).
- CSV files must be encoded with UTF-8 BOM (`\uFEFF`) and RFC 4180 delimiter escaping to prevent CSV injection and display Spanish accented characters properly in Microsoft Excel.

---

## 6. Dashboard KPI Calculation Rules and Aggregation Invariants

### 6.1 Period Boundaries Formulation
Dashboard periods filter financial activity by transaction contractual issue date (`issue_date`):
- **This Month (`month`)**: First calendar day of the active month ($T_{\text{start}} = \text{YYYY-MM-01}$) to the final day of the active month ($T_{\text{end}} = \text{YYYY-MM-LD}$).
- **This Quarter (`quarter`)**: First calendar day of the active quarter ($Q \in \{1: \text{Jan-Mar}, 2: \text{Apr-Jun}, 3: \text{Jul-Sep}, 4: \text{Oct-Dec}\}$) to the final day of the active quarter.
- **Current Year (`year`)**: First day of the calendar year ($\text{YYYY-01-01}$) to the final day of the calendar year ($\text{YYYY-12-31}$).

### 6.2 Authoritative KPI Definitions
1. **Net Sales / Revenue**:
   $$
   \text{net\_sales} = \sum_{inv \in S} inv.\text{subtotal}
   $$
   where $S = \{ inv \in \text{sales\_invoices} \mid inv.\text{company\_id} = C \land inv.\text{status} \in \{\text{'issued'}, \text{'partial'}, \text{'paid'}, \text{'overdue'}\} \land inv.\text{issue\_date} \in [T_{\text{start}}, T_{\text{end}}] \}$. Draft and void documents are strictly excluded.
2. **Expenses & Purchases**:
   $$
   \text{total\_expenses} = \sum_{pur \in P} pur.\text{subtotal}
   $$
   where $P = \{ pur \in \text{purchase\_documents} \mid pur.\text{company\_id} = C \land pur.\text{status} \in \{\text{'issued'}, \text{'partial'}, \text{'paid'}, \text{'overdue'}\} \land pur.\text{issue\_date} \in [T_{\text{start}}, T_{\text{end}}] \}$.
3. **Operating Gross Margin**:
   $$
   \text{operating\_margin} = \text{round}(\text{net\_sales} - \text{total\_expenses}, 2)
   $$
   $$
   \text{margin\_percentage} = \begin{cases}
   \text{round}((\frac{\text{operating\_margin}}{\text{net\_sales}}) \times 100, 2) & \text{if } \text{net\_sales} > 0 \\
   0 & \text{otherwise}
   \end{cases}
   $$
4. **Accounts Receivable (CxC)**:
   Cumulative balance snapshot across all open customer invoices:
   $$
   \text{cxc} = \sum_{inv \in \text{sales\_invoices}} inv.\text{balance\_due}
   $$
   where $inv.\text{company\_id} = C \land inv.\text{status} \in \{\text{'issued'}, \text{'partial'}, \text{'overdue'}\} \land inv.\text{balance\_due} > 0$.
5. **Accounts Payable (CxP)**:
   Cumulative balance snapshot across all open supplier purchase documents:
   $$
   \text{cxp} = \sum_{pur \in \text{purchase\_documents}} pur.\text{balance\_due}
   $$
   where $pur.\text{company\_id} = C \land pur.\text{status} \in \{\text{'issued'}, \text{'partial'}, \text{'overdue'}\} \land pur.\text{balance\_due} > 0$.
6. **Estimated IVA Payable**:
   $$
   \text{generated\_iva} = \sum_{inv \in S} inv.\text{tax\_total}
   $$
   $$
   \text{deductible\_iva} = \sum_{pur \in P} \max(pur.\text{deductible\_tax\_total}, pur.\text{tax\_total})
   $$
   $$
   \text{estimated\_iva\_payable} = \max(0, \text{round}(\text{generated\_iva} - \text{deductible\_iva}, 2))
   $$
7. **Inventory Valuation & Low Stock**:
   For all active catalog products where $\text{is\_inventory\_item} = \text{true}$:
   $$
   \text{current\_stock}_p = \sum_{m \in M_p} m.\text{quantity\_delta}
   $$
   $$
   \text{valuation} = \sum_p \text{round}(\max(0, \text{current\_stock}_p) \times p.\text{cost}, 2)
   $$
   Low stock condition: $\text{current\_stock}_p \le p.\text{stock\_minimum}$.

