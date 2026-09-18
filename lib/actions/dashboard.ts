// ============================================================================
// Paguro Finance - Financial Dashboard Server Actions
// Authoritative Real Supabase Data, Server-Side Aggregations, Zero mock-store
// ============================================================================

'use server';

import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  DashboardData,
  DashboardPeriod,
  Company,
  UserRole,
} from '@/types/database';
import {
  getDashboardPeriodDates,
  calculateDashboardKpis,
  formatDashboardRecentSales,
  formatDashboardRecentPurchases,
  formatDashboardRecentPayments,
} from '@/lib/finance/dashboard';

export { getDashboardPeriodDates };

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const READ_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'VIEWER'];

/**
 * Authoritative consolidated dashboard data retrieval action.
 * Performs parallel database queries scoped strictly to active company.
 */
export async function getDashboardDataAction(
  period: DashboardPeriod = 'month'
): Promise<ActionResponse<DashboardData>> {
  try {
    const session = await getServerAuthSession();
    if (!session) {
      return { success: false, error: 'Sesión no iniciada.' };
    }

    if (!READ_ROLES.includes(session.activeRole)) {
      return { success: false, error: 'Permiso denegado para consultar el panel financiero.' };
    }

    const companyId = session.activeCompanyId;
    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Cliente de base de datos no disponible.' };
    }

    const { dateFrom, dateTo } = getDashboardPeriodDates(period);

    // Run parallel queries across all dashboard operational areas
    const [
      companyRes,
      periodSalesRes,
      openReceivablesRes,
      periodPurchasesRes,
      openPayablesRes,
      productsRes,
      movementsRes,
      recentSalesRes,
      recentPurchasesRes,
      recentPaymentsRes,
    ] = await Promise.all([
      // 1. Company Information
      supabase
        .from('companies')
        .select('id, trade_name, legal_name, tax_id, currency_code')
        .eq('id', companyId)
        .single(),

      // 2. Sales Invoices in Period (Issued, Partial, Paid, Overdue)
      supabase
        .from('sales_invoices')
        .select('id, subtotal, tax_total, total, balance_due, status, issue_date')
        .eq('company_id', companyId)
        .in('status', ['issued', 'partial', 'paid', 'overdue'])
        .gte('issue_date', dateFrom)
        .lte('issue_date', dateTo),

      // 3. Open Accounts Receivable Snapshot (All uncollected active balances)
      supabase
        .from('sales_invoices')
        .select('id, balance_due')
        .eq('company_id', companyId)
        .in('status', ['issued', 'partial', 'overdue'])
        .gt('balance_due', 0),

      // 4. Purchase Documents & Expenses in Period (Open/Issued, Partial, Paid, Overdue)
      supabase
        .from('purchase_documents')
        .select('id, subtotal, total, balance_due, status, deductible_tax_total, document_date')
        .eq('company_id', companyId)
        .in('status', ['open', 'issued', 'partial', 'paid', 'overdue'])
        .gte('document_date', dateFrom)
        .lte('document_date', dateTo),

      // 5. Open Accounts Payable Snapshot (All outstanding supplier obligations)
      supabase
        .from('purchase_documents')
        .select('id, balance_due')
        .eq('company_id', companyId)
        .in('status', ['open', 'issued', 'partial', 'overdue'])
        .gt('balance_due', 0),

      // 6. Active Products
      supabase
        .from('products')
        .select('id, cost, stock_minimum, is_inventory_item, status')
        .eq('company_id', companyId)
        .eq('status', 'active'),

      // 7. Inventory Movements
      supabase
        .from('inventory_movements')
        .select('product_id, quantity_delta')
        .eq('company_id', companyId),

      // 8. Top 5 Recent Sales Invoices
      supabase
        .from('sales_invoices')
        .select('id, invoice_number, issue_date, total, balance_due, status, customer:customers(name, legal_name)')
        .eq('company_id', companyId)
        .order('issue_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),

      // 9. Top 5 Recent Purchases & Expenses
      supabase
        .from('purchase_documents')
        .select('id, document_number, document_date, total, balance_due, status, category, supplier:suppliers(name, legal_name)')
        .eq('company_id', companyId)
        .order('document_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),

      // 10. Top 5 Recent Payments
      supabase
        .from('payments')
        .select('id, payment_date, direction, method, reference, amount, status, counterparty_type, counterparty_id')
        .eq('company_id', companyId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (companyRes.error || !companyRes.data) {
      return { success: false, error: 'No se encontró la empresa activa en la base de datos.' };
    }

    const company = companyRes.data;

    // --- Compute Authoritative KPIs ---
    const kpis = calculateDashboardKpis({
      periodInvoices: periodSalesRes.data || [],
      openInvoices: openReceivablesRes.data || [],
      periodPurchases: periodPurchasesRes.data || [],
      openPurchases: openPayablesRes.data || [],
      activeProducts: (productsRes.data || []).map((p: any) => ({
        ...p,
        cost: Number(p.cost) || 0,
        stock_minimum: Number(p.stock_minimum) || 0,
      })),
      movements: (movementsRes.data || []).map((m: any) => ({
        ...m,
        quantity_delta: Number(m.quantity_delta) || 0,
      })),
    });

    // Lookup counterparty names for recent payments if any
    const rawPayments = recentPaymentsRes.data || [];
    const counterpartyMap: Record<string, string> = {};
    const customerIds = rawPayments.filter((p: any) => p.counterparty_type === 'customer').map((p: any) => p.counterparty_id);
    const supplierIds = rawPayments.filter((p: any) => p.counterparty_type === 'supplier').map((p: any) => p.counterparty_id);

    if (customerIds.length > 0) {
      const { data: custs } = await supabase.from('customers').select('id, name, legal_name').in('id', customerIds);
      (custs || []).forEach((c: any) => {
        counterpartyMap[c.id] = c.name || c.legal_name || 'Cliente';
      });
    }

    if (supplierIds.length > 0) {
      const { data: supps } = await supabase.from('suppliers').select('id, name, legal_name').in('id', supplierIds);
      (supps || []).forEach((s: any) => {
        counterpartyMap[s.id] = s.name || s.legal_name || 'Proveedor';
      });
    }

    // --- Format Recent Transactions ---
    const recentSales = formatDashboardRecentSales(recentSalesRes.data || []);
    const recentPurchases = formatDashboardRecentPurchases(recentPurchasesRes.data || []);
    const recentPayments = formatDashboardRecentPayments(rawPayments, counterpartyMap);

    const dashboardData: DashboardData = {
      company: {
        id: company.id,
        trade_name: company.trade_name || company.legal_name,
        legal_name: company.legal_name,
        tax_id: company.tax_id,
        currency_code: company.currency_code || 'COP',
      },
      period,
      date_from: dateFrom,
      date_to: dateTo,
      kpis,
      recentSales,
      recentPurchases,
      recentPayments,
    };

    return {
      success: true,
      data: dashboardData,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error inesperado al cargar métricas del panel.',
    };
  }
}

/**
 * Returns authorized companies where the current authenticated user has active membership.
 */
export async function getAuthorizedCompaniesAction(): Promise<
  ActionResponse<Array<{ company: Company; role: UserRole }>>
> {
  try {
    const session = await getServerAuthSession();
    if (!session) {
      return { success: false, error: 'Sesión no iniciada.' };
    }

    return {
      success: true,
      data: session.companies,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error al obtener empresas autorizadas.',
    };
  }
}

/**
 * Switches the active company cookie for the current user after validating membership.
 */
export async function switchActiveCompanyAction(
  companyId: string
): Promise<ActionResponse<{ companyId: string }>> {
  try {
    const session = await getServerAuthSession();
    if (!session) {
      return { success: false, error: 'Sesión no iniciada.' };
    }

    const membership = session.companies.find((c) => c.company.id === companyId);
    if (!membership) {
      return {
        success: false,
        error: 'Acceso denegado: el usuario no tiene membresía activa en esta empresa.',
      };
    }

    const cookieStore = cookies();
    cookieStore.set('paguro_active_company', companyId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return {
      success: true,
      data: { companyId },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error al cambiar de empresa activa.',
    };
  }
}
