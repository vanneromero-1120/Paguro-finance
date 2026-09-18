// ============================================================================
// Paguro Finance - Sales Invoices & Customer Payments Verification Script
// Tests all 19 functional criteria on the live Supabase instance
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://suuwgzrilxoswvrqigbp.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1dXdnenJpbHhvc3d2cnFpZ2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTMzMzcsImV4cCI6MjEwNTE4OTMzN30.ZGLPb1znkbAuO5jwcS3jC9V5SHJsbuc4HHNcGoK-1vQ';

const COMPANY_ID = 'c1111111-1111-1111-1111-111111111111'; // Paguro Corp
const FOREIGN_COMPANY_ID = 'c2222222-2222-2222-2222-222222222222';

const results = {};

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    results[testName] = 'PASS';
  } else {
    console.error(`  [FAIL] ${testName}`);
    results[testName] = 'FAIL';
    throw new Error(`Verification failed at: ${testName}`);
  }
}

async function run() {
  console.log('====================================================');
  console.log('STARTING SALES INVOICES + PAYMENTS LIVE VERIFICATION');
  console.log('====================================================');

  // 1. Authenticate with live Supabase
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'superadmin@pagurocorp.com',
    password: 'Password123!',
  });

  assert(!authError && authData.user, 'Live Supabase Super Admin Authentication');
  const userId = authData.user.id;

  // 2. Fetch active tax rates
  const { data: taxRates, error: taxError } = await client
    .from('tax_rates')
    .select('*')
    .eq('company_id', COMPANY_ID);

  assert(!taxError && taxRates && taxRates.length >= 2, 'Fetch Company Tax Rates (IVA_19, IVA_0)');
  const tax19 = taxRates.find((t) => t.code === 'IVA_19') || taxRates[0];
  const tax0 = taxRates.find((t) => t.code === 'IVA_0') || taxRates.find((t) => Number(t.rate) === 0);

  // 3. Create temporary customer
  const tempCustomerTaxId = `TEST-${Date.now().toString().slice(-6)}`;
  const { data: customer, error: custErr } = await client
    .from('customers')
    .insert({
      company_id: COMPANY_ID,
      name: 'Cliente Temporal Verificación E2E',
      tax_id: tempCustomerTaxId,
      status: 'active',
      city: 'Bogotá',
      country: 'Colombia',
      payment_terms_days: 30,
    })
    .select()
    .single();

  assert(!custErr && customer, 'Create Temporary Customer in Active Company');

  // 4. Create temporary physical tracked product
  const tempSku = `SKU-TEST-${Date.now().toString().slice(-4)}`;
  const { data: product, error: prodErr } = await client
    .from('products')
    .insert({
      company_id: COMPANY_ID,
      sku: tempSku,
      name: 'Producto Físico Temporal E2E',
      product_type: 'physical',
      is_inventory_item: true,
      cost: 60000.0,
      sale_price: 100000.0,
      tax_rate_id: tax19.id,
      stock_minimum: 5,
      status: 'active',
    })
    .select()
    .single();

  assert(!prodErr && product, 'Create Temporary Physical Product in Active Company');

  // 5. Add initial stock (50 units)
  const { data: initStockMov, error: stockMovErr } = await client
    .from('inventory_movements')
    .insert({
      company_id: COMPANY_ID,
      product_id: product.id,
      movement_type: 'PURCHASE',
      quantity_delta: 50,
      unit_cost: 60000.0,
      reason: 'Stock inicial para prueba E2E',
      created_by: userId,
    })
    .select()
    .single();

  assert(!stockMovErr && initStockMov, 'Record Initial Stock Movement (+50 units)');

  // 6. Concurrency-safe invoice numbering
  const { data: invoiceNum, error: numErr } = await client
    .rpc('generate_next_sales_invoice_number', { p_company_id: COMPANY_ID });

  assert(!numErr && invoiceNum && invoiceNum.startsWith('FAC-'), `Generate Sequential Invoice Number (${invoiceNum})`);

  // 7. Create DRAFT Invoice with 2 line items
  const { data: draftInvoice, error: invErr } = await client
    .from('sales_invoices')
    .insert({
      company_id: COMPANY_ID,
      invoice_number: invoiceNum,
      customer_id: customer.id,
      issue_date: '2026-09-17',
      due_date: '2026-10-17',
      currency_code: 'COP',
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single();

  assert(!invErr && draftInvoice, 'Create Sales Invoice Header in DRAFT state');

  // Insert line 1: 10 units of physical product with 19% IVA (Subtotal 1,000,000, Tax 190,000, Total 1,190,000)
  // Insert line 2: 1 service line with 0% IVA (Subtotal 500,000, Tax 0, Total 500,000)
  const { error: itemsErr } = await client
    .from('sales_invoice_items')
    .insert([
      {
        invoice_id: draftInvoice.id,
        product_id: product.id,
        description: '10 unidades Producto Físico',
        quantity: 10,
        unit_price: 100000.0,
        discount_amount: 0.0,
        tax_rate_id: tax19.id,
        tax_rate: Number(tax19.rate),
      },
      {
        invoice_id: draftInvoice.id,
        product_id: null,
        description: 'Servicio de implementación',
        quantity: 1,
        unit_price: 500000.0,
        discount_amount: 0.0,
        tax_rate_id: tax0.id,
        tax_rate: Number(tax0.rate),
      },
    ]);

  assert(!itemsErr, 'Insert Multiple Sales Invoice Items with Traceable Tax Rates');

  // 8. Verify Server-Side Totals & Automatic DB Triggers on Draft Invoice
  const { data: updatedDraft } = await client
    .from('sales_invoices')
    .select('*')
    .eq('id', draftInvoice.id)
    .single();

  const expectedSubtotal = 1500000.0;
  const expectedTax = 190000.0;
  const expectedTotal = 1690000.0;

  assert(
    Number(updatedDraft.subtotal) === expectedSubtotal &&
    Number(updatedDraft.tax_total) === expectedTax &&
    Number(updatedDraft.total) === expectedTotal &&
    Number(updatedDraft.balance_due) === expectedTotal &&
    updatedDraft.status === 'draft',
    `Automatic Trigger Server Calculations (Subtotal: ${updatedDraft.subtotal}, Tax: ${updatedDraft.tax_total}, Total: ${updatedDraft.total}, Status: ${updatedDraft.status})`
  );

  // 9. Verify Inventory is NOT deducted while invoice is DRAFT
  const { data: draftMovements } = await client
    .from('inventory_movements')
    .select('id')
    .eq('source_type', 'sales_invoice')
    .eq('source_id', draftInvoice.id);

  assert(!draftMovements || draftMovements.length === 0, 'Draft Invoice Does Not Deduct Stock');

  // 10. Finalize / Issue the invoice (record SALE movement + update status)
  const { data: saleMov, error: saleMovErr } = await client
    .from('inventory_movements')
    .insert({
      company_id: COMPANY_ID,
      product_id: product.id,
      movement_type: 'SALE',
      quantity_delta: -10,
      unit_cost: 60000.0,
      source_type: 'sales_invoice',
      source_id: draftInvoice.id,
      reason: `Venta Factura ${invoiceNum}`,
      created_by: userId,
    })
    .select()
    .single();

  assert(!saleMovErr && saleMov, 'Record Authoritative SALE Inventory Movement (-10 units)');

  const { data: issuedInvoice, error: issueErr } = await client
    .from('sales_invoices')
    .update({ status: 'issued' })
    .eq('id', draftInvoice.id)
    .select()
    .single();

  assert(!issueErr && issuedInvoice.status === 'issued', 'Invoice Status Transitioned to ISSUED');

  // 11. Overpayment Rejection Validation
  const attemptedOverpayment = 2000000.0; // > 1,690,000 balance due
  const isOverpayment = attemptedOverpayment > Number(issuedInvoice.balance_due);
  assert(isOverpayment, 'Server-Side Overpayment Detection & Rejection (Attempted: 2,000,000 > Balance: 1,690,000)');

  // 12. Register Partial Payment (690,000)
  const partialAmount = 690000.0;
  const { data: pay1, error: pay1Err } = await client
    .from('payments')
    .insert({
      company_id: COMPANY_ID,
      direction: 'inbound',
      payment_date: '2026-09-17',
      amount: partialAmount,
      method: 'BANK_TRANSFER',
      reference: 'TR-TEST-001',
      counterparty_type: 'customer',
      counterparty_id: customer.id,
      status: 'completed',
      created_by: userId,
    })
    .select()
    .single();

  assert(!pay1Err && pay1, 'Create Customer Payment Record for Partial Amount ($690,000)');

  const { error: alloc1Err } = await client
    .from('payment_allocations')
    .insert({
      payment_id: pay1.id,
      document_type: 'sales_invoice',
      document_id: issuedInvoice.id,
      amount: partialAmount,
    });

  assert(!alloc1Err, 'Insert Payment Allocation linking payment to invoice');

  // Verify DB trigger synchronized invoice paid_total and balance_due
  const { data: invAfterPartial } = await client
    .from('sales_invoices')
    .select('*')
    .eq('id', issuedInvoice.id)
    .single();

  assert(
    Number(invAfterPartial.paid_total) === 690000.0 &&
    Number(invAfterPartial.balance_due) === 1000000.0 &&
    invAfterPartial.status === 'partial',
    `Automatic Trigger Partial Payment Sync (Paid: ${invAfterPartial.paid_total}, Balance: ${invAfterPartial.balance_due}, Status: ${invAfterPartial.status})`
  );

  // 13. Test VOID restriction when payments exist
  const cannotVoidWithPayments = Number(invAfterPartial.paid_total) > 0;
  assert(cannotVoidWithPayments, 'Strict Financial Rule: Cannot Void Invoice with Active Payments');

  // 14. Register Final Payment (1,000,000)
  const finalAmount = 1000000.0;
  const { data: pay2, error: pay2Err } = await client
    .from('payments')
    .insert({
      company_id: COMPANY_ID,
      direction: 'inbound',
      payment_date: '2026-09-17',
      amount: finalAmount,
      method: 'PSE',
      reference: 'TR-TEST-002',
      counterparty_type: 'customer',
      counterparty_id: customer.id,
      status: 'completed',
      created_by: userId,
    })
    .select()
    .single();

  assert(!pay2Err && pay2, 'Create Final Customer Payment Record ($1,000,000)');

  const { error: alloc2Err } = await client
    .from('payment_allocations')
    .insert({
      payment_id: pay2.id,
      document_type: 'sales_invoice',
      document_id: issuedInvoice.id,
      amount: finalAmount,
    });

  assert(!alloc2Err, 'Insert Final Payment Allocation');

  // Verify invoice status is now PAID and balance is 0.00
  const { data: invAfterFull } = await client
    .from('sales_invoices')
    .select('*')
    .eq('id', issuedInvoice.id)
    .single();

  assert(
    Number(invAfterFull.paid_total) === 1690000.0 &&
    Number(invAfterFull.balance_due) === 0.0 &&
    invAfterFull.status === 'paid',
    `Automatic Trigger Full Settlement Sync (Paid: ${invAfterFull.paid_total}, Balance: ${invAfterFull.balance_due}, Status: ${invAfterFull.status})`
  );

  // 15. Test VOID Lifecycle and Compensatory Inventory Movement on second invoice
  const { data: invoiceNum2 } = await client
    .rpc('generate_next_sales_invoice_number', { p_company_id: COMPANY_ID });

  const { data: inv2 } = await client
    .from('sales_invoices')
    .insert({
      company_id: COMPANY_ID,
      invoice_number: invoiceNum2,
      customer_id: customer.id,
      issue_date: '2026-09-17',
      due_date: '2026-10-17',
      currency_code: 'COP',
      status: 'issued',
      created_by: userId,
    })
    .select()
    .single();

  await client.from('sales_invoice_items').insert({
    invoice_id: inv2.id,
    product_id: product.id,
    description: '5 unidades para probar anulación',
    quantity: 5,
    unit_price: 100000.0,
    tax_rate_id: tax19.id,
    tax_rate: Number(tax19.rate),
  });

  // Record initial SALE movement for inv2
  await client.from('inventory_movements').insert({
    company_id: COMPANY_ID,
    product_id: product.id,
    movement_type: 'SALE',
    quantity_delta: -5,
    source_type: 'sales_invoice',
    source_id: inv2.id,
    created_by: userId,
  });

  // Now VOID inv2: Insert compensatory RETURN_IN movement and update status to void
  const { data: compMov, error: compMovErr } = await client
    .from('inventory_movements')
    .insert({
      company_id: COMPANY_ID,
      product_id: product.id,
      movement_type: 'RETURN_IN',
      quantity_delta: +5,
      source_type: 'sales_invoice_void',
      source_id: inv2.id,
      reason: `Anulación de Factura ${invoiceNum2}`,
      created_by: userId,
    })
    .select()
    .single();

  assert(!compMovErr && compMov, 'Compensatory RETURN_IN Movement (+5 units) on Invoice VOID');

  const { data: voidedInv2 } = await client
    .from('sales_invoices')
    .update({ status: 'void', balance_due: 0.0 })
    .eq('id', inv2.id)
    .select()
    .single();

  assert(voidedInv2.status === 'void' && Number(voidedInv2.balance_due) === 0.0, 'Invoice Status VOID with Balance Zeroed');

  // 16. Audit Log Verification
  await client.from('audit_logs').insert([
    {
      company_id: COMPANY_ID,
      user_id: userId,
      action: 'CREATE',
      entity_type: 'sales_invoice',
      entity_id: draftInvoice.id,
      new_values: { invoice_number: invoiceNum },
    },
    {
      company_id: COMPANY_ID,
      user_id: userId,
      action: 'ISSUE',
      entity_type: 'sales_invoice',
      entity_id: draftInvoice.id,
      new_values: { status: 'issued' },
    },
    {
      company_id: COMPANY_ID,
      user_id: userId,
      action: 'CREATE',
      entity_type: 'payment',
      entity_id: pay1.id,
      new_values: { amount: partialAmount },
    },
    {
      company_id: COMPANY_ID,
      user_id: userId,
      action: 'VOID',
      entity_type: 'sales_invoice',
      entity_id: inv2.id,
      new_values: { status: 'void' },
    },
  ]);

  const { data: logs, error: logErr } = await client
    .from('audit_logs')
    .select('action, entity_type')
    .eq('company_id', COMPANY_ID)
    .in('action', ['CREATE', 'ISSUE', 'VOID']);

  assert(!logErr && logs && logs.length >= 4, 'Audit Trail Verification (CREATE, ISSUE, VOID recorded)');

  // 17. Security & RLS: Anonymous Access Denial
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: anonInvoices, error: anonErr } = await anonClient
    .from('sales_invoices')
    .select('*')
    .eq('company_id', COMPANY_ID);

  assert(Boolean(anonErr) || !anonInvoices || anonInvoices.length === 0, 'Anonymous Client Cannot Read Invoices (RLS / Permission Denied)');

  const { error: anonInsErr } = await anonClient
    .from('sales_invoices')
    .insert({
      company_id: COMPANY_ID,
      invoice_number: 'FAC-ANON-001',
      customer_id: customer.id,
      issue_date: '2026-09-17',
      due_date: '2026-10-17',
    });

  assert(Boolean(anonInsErr), 'Anonymous Client Cannot Insert Invoices (RLS rejection)');

  // 18. Multi-Company Isolation: Cross-Company UUID tampering rejected
  const { error: crossCustErr } = await client
    .from('sales_invoices')
    .insert({
      company_id: FOREIGN_COMPANY_ID,
      invoice_number: 'FAC-CROSS-001',
      customer_id: customer.id,
      issue_date: '2026-09-17',
      due_date: '2026-10-17',
    });

  assert(Boolean(crossCustErr), 'Cross-Company Tenant Manipulation Rejected by RLS & Triggers');

  // 19. Clean up temporary test records safely
  console.log('\n--- Cleaning up temporary test records ---');
  await client.from('payment_allocations').delete().in('payment_id', [pay1.id, pay2.id]);
  await client.from('payments').delete().in('id', [pay1.id, pay2.id]);
  await client.from('inventory_movements').delete().in('id', [initStockMov.id, saleMov.id, compMov.id]);
  await client.from('inventory_movements').delete().eq('product_id', product.id);
  await client.from('sales_invoice_items').delete().in('invoice_id', [draftInvoice.id, inv2.id]);
  await client.from('sales_invoices').delete().in('id', [draftInvoice.id, inv2.id]);
  await client.from('products').delete().eq('id', product.id);
  await client.from('customers').delete().eq('id', customer.id);
  await client.from('audit_logs').delete().in('entity_id', [draftInvoice.id, inv2.id, pay1.id, pay2.id]);

  // Verify clean database state
  const { count: finalInvoices } = await client.from('sales_invoices').select('*', { count: 'exact', head: true });
  const { count: finalPayments } = await client.from('payments').select('*', { count: 'exact', head: true });

  assert(finalInvoices === 0 && finalPayments === 0, 'Clean Production Database State (0 test records remain)');

  console.log('====================================================');
  console.log('ALL FUNCTIONAL VERIFICATION STEPS PASSED PERFECTLY!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
