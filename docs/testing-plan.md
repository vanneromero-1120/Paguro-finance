# Paguro Finance - Testing and Verification Plan

## 1. Objectives

This testing plan defines the automated and manual verification strategies to ensure that **Paguro Finance** operates with zero financial inaccuracies, maintains strict multi-tenant isolation, and prevents unauthorized operations.

---

## 2. Test Pyramid & Scope

```
             ┌─────────────────────────┐
             │       E2E Tests         │
             │  (Full User Flows)      │
             ├─────────────────────────┤
             │    Integration Tests    │
             │ (RLS, Triggers, Alloc.) │
             ├─────────────────────────┤
             │       Unit Tests        │
             │ (Math, Invariants, Tax) │
             └─────────────────────────┘
```

---

## 3. Test Suites

### 3.1 Suite 1: Financial & Math Calculations (Unit Tests)
- **File**: `tests/calculations.test.ts`
- **Tests**:
  1. Line item math: `quantity * unit_price - discount = subtotal`.
  2. Tax calculation: `subtotal * tax_rate = tax_amount`.
  3. Header aggregation: `sum(subtotals) = invoice.subtotal`, `sum(taxes) = invoice.tax_total`, `total = subtotal + tax_total`.
  4. Half-up rounding consistency across fractional quantities and rates (e.g. 19% on $123,456.78).
  5. Balance calculation: `balance_due = total - paid_total`.

### 3.2 Suite 2: Payment Allocations & Balances (Integration Tests)
- **File**: `tests/payments.test.ts`
- **Tests**:
  1. Single full payment transitions invoice status from `issued` to `paid`.
  2. Partial payment transitions invoice status from `issued` to `partial`.
  3. Over-allocation prevention: Attempting to allocate an amount greater than `balance_due` is rejected.
  4. Multiple payments accumulating to the exact total balance.
  5. Voiding a payment correctly restores the original `balance_due` and reverts invoice status.

### 3.3 Suite 3: Inventory Movement Ledger (Unit & Integration Tests)
- **File**: `tests/inventory.test.ts`
- **Tests**:
  1. Stock derivation: Sum of positive movements (`PURCHASE`, `RETURN_IN`) minus negative movements (`SALE`, `DAMAGED`) equals reported stock.
  2. Negative stock prevention: Outbound movement exceeding current stock throws an error.
  3. Low stock threshold alert triggers when `stock <= stock_minimum`.
  4. Services do not generate inventory movements.

### 3.4 Suite 4: Tax Engine & Period Closing (Unit Tests)
- **File**: `tests/taxes.test.ts`
- **Tests**:
  1. Correct aggregation of `generated_tax` from issued sales invoices in the date window.
  2. Correct aggregation of `deductible_tax` from purchase documents in the date window.
  3. Net tax calculation including positive and negative manual adjustments.
  4. Attempting to add an invoice with date in a closed tax period is rejected.

### 3.5 Suite 5: Multi-Tenant Isolation & RLS (Integration Tests)
- **File**: `tests/rls-matrix.test.ts`
- **Tests**:
  1. User belonging only to Company A receives 0 records when querying Company B's invoices.
  2. User with `VIEWER` role in Company A cannot insert or update invoices.
  3. User with `FINANCE` role cannot close tax periods.
  4. Cross-company foreign key injection (creating an invoice for Company A referencing a customer from Company B) is rejected by constraints.

---

## 4. Acceptance Criteria Checklist

- [ ] All unit and integration tests pass without failure.
- [ ] TypeScript compiles cleanly with zero errors (`npm run build`).
- [ ] No API secrets or service role keys exposed in client bundles.
- [ ] Dashboard displays accurate KPIs derived from underlying test seed data.
- [ ] `Paguro_Finance_Blueprint_Arquitectura_Funcional.docx` is preserved completely untouched.
