// ============================================================================
// Paguro Finance V1 - Payment Platform Architecture & Normalization Engine
// Provider Abstractions: Stripe, PayPal, Shopify, Mercado Pago, Wompi, Addi, PayU
// Normalizes gateway events into authoritative financial_movements
// ============================================================================

import { CreateMovementInput } from '../actions/movements';
import { MovementDirection } from '../../types/v1-financial';

export type PaymentGatewayProvider =
  | 'STRIPE'
  | 'PAYPAL'
  | 'SHOPIFY_PAYMENTS'
  | 'MERCADO_PAGO'
  | 'WOMPI'
  | 'ADDI'
  | 'PAYU';

export interface RawGatewayTransaction {
  provider: PaymentGatewayProvider;
  transaction_id: string;
  created_at: string;
  gross_amount: number;
  fee_amount?: number;
  net_amount?: number;
  currency: string;
  customer_name?: string;
  customer_email?: string;
  customer_tax_id?: string;
  type: 'PAYMENT' | 'PAYOUT' | 'REFUND' | 'FEE' | 'DISPUTE';
  description?: string;
  reference_order_id?: string;
}

export interface PaymentProviderStatus {
  provider: PaymentGatewayProvider;
  name: string;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'NEEDS_ATTENTION';
  supportedCurrencies: string[];
  requiresWebhook: boolean;
  notes: string;
}

export const PAYMENT_PROVIDERS_REGISTRY: Record<PaymentGatewayProvider, PaymentProviderStatus> = {
  STRIPE: {
    provider: 'STRIPE',
    name: 'Stripe',
    status: 'NOT_CONFIGURED',
    supportedCurrencies: ['USD', 'COP', 'EUR'],
    requiresWebhook: true,
    notes: 'Requiere STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET en .env.local',
  },
  PAYPAL: {
    provider: 'PAYPAL',
    name: 'PayPal',
    status: 'NOT_CONFIGURED',
    supportedCurrencies: ['USD', 'EUR'],
    requiresWebhook: true,
    notes: 'Requiere PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en .env.local',
  },
  SHOPIFY_PAYMENTS: {
    provider: 'SHOPIFY_PAYMENTS',
    name: 'Shopify Payments',
    status: 'NOT_CONFIGURED',
    supportedCurrencies: ['USD', 'COP'],
    requiresWebhook: true,
    notes: 'Requiere SHOPIFY_ADMIN_ACCESS_TOKEN en .env.local',
  },
  MERCADO_PAGO: {
    provider: 'MERCADO_PAGO',
    name: 'Mercado Pago (Colombia)',
    status: 'NOT_CONFIGURED',
    supportedCurrencies: ['COP'],
    requiresWebhook: true,
    notes: 'Requiere MP_ACCESS_TOKEN y MP_PUBLIC_KEY en .env.local',
  },
  WOMPI: {
    provider: 'WOMPI',
    name: 'Wompi (Bancolombia)',
    status: 'NOT_CONFIGURED',
    supportedCurrencies: ['COP'],
    requiresWebhook: true,
    notes: 'Requiere WOMPI_PRIVATE_KEY y WOMPI_EVENTS_SECRET en .env.local',
  },
  ADDI: {
    provider: 'ADDI',
    name: 'Addi (BNPL Colombia)',
    status: 'NOT_CONFIGURED',
    supportedCurrencies: ['COP'],
    requiresWebhook: true,
    notes: 'Requiere ADDI_CLIENT_ID y ADDI_SECRET en .env.local',
  },
  PAYU: {
    provider: 'PAYU',
    name: 'PayU Latam',
    status: 'NOT_CONFIGURED',
    supportedCurrencies: ['COP', 'USD'],
    requiresWebhook: true,
    notes: 'Requiere PAYU_API_KEY y PAYU_MERCHANT_ID en .env.local',
  },
};

/**
 * Normalizes raw payment gateway events into the authoritative financial_movements model.
 * Handles gross amounts, fee deductions, net revenue, currency exchange, and tax relevance.
 */
export function normalizeGatewayEventToFinancialMovement(
  event: RawGatewayTransaction,
  defaultExchangeRateToCop: number = 4100
): CreateMovementInput {
  const isIncome = event.type === 'PAYMENT' || event.type === 'PAYOUT';
  const direction: MovementDirection = isIncome ? 'INCOME' : 'EXPENSE';

  const exchangeRate =
    event.currency.toUpperCase() === 'COP' ? 1 : defaultExchangeRateToCop;

  // Build clean description indicating fee deductions where applicable
  let desc = event.description || `${event.provider} - Transacción ${event.transaction_id}`;
  if (event.fee_amount && event.fee_amount > 0) {
    desc += ` (Comisión pasarela: ${event.fee_amount} ${event.currency})`;
  }

  return {
    movement_date: event.created_at.split('T')[0],
    direction,
    movement_type: event.type,
    source_type: 'PAYMENT_PLATFORM',
    source_id: `${event.provider}_${event.transaction_id}`,
    description: desc,
    counterparty: event.customer_name || `${event.provider} Customer`,
    counterparty_tax_id: event.customer_tax_id || undefined,
    original_amount: event.gross_amount,
    currency: event.currency.toUpperCase(),
    exchange_rate: exchangeRate,
    payment_method: event.provider,
    tax_relevance: isIncome ? 'TAXABLE' : 'NON_TAXABLE',
    external_reference: event.reference_order_id || event.transaction_id,
    confidence_score: 1.0,
    review_status: 'CONFIRMED',
  };
}
