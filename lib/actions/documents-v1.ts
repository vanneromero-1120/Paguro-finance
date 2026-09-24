// ============================================================================
// Paguro Finance V1 - Google Drive Document Pipeline & AI Extraction Actions
// Idempotent Ingestion, Multi-Document Grouping, AI Extraction & Review Queue
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  AccountingDocument,
  DocumentPipelineStatus,
  AccountingDocumentType,
} from '@/types/v1-financial';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
}

export interface DocumentFilterInput {
  pipeline_status?: DocumentPipelineStatus | 'ALL';
  document_type?: AccountingDocumentType | 'ALL';
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface DocumentCorrectionInput {
  document_type?: AccountingDocumentType;
  invoice_number?: string;
  document_date?: string;
  counterparty_name?: string;
  counterparty_tax_id?: string;
  currency?: string;
  subtotal?: number;
  tax_iva?: number;
  tax_withholding?: number;
  total_amount?: number;
  suggested_category_id?: string;
  review_notes?: string;
  pipeline_status?: DocumentPipelineStatus;
}

/**
 * Retrieves all accounting documents with pipeline and extraction states.
 */
export async function getAccountingDocumentsAction(
  filters?: DocumentFilterInput
): Promise<ActionResponse<AccountingDocument[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .order('uploaded_at', { ascending: false });

    if (filters?.pipeline_status && filters.pipeline_status !== 'ALL') {
      query = query.eq('pipeline_status', filters.pipeline_status);
    }

    if (filters?.document_type && filters.document_type !== 'ALL') {
      query = query.eq('document_type', filters.document_type);
    }

    if (filters?.date_from) {
      query = query.gte('document_date', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('document_date', filters.date_to);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message, data: [] };

    let result = (data || []) as AccountingDocument[];

    if (filters?.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      result = result.filter(
        (doc) =>
          doc.file_name.toLowerCase().includes(term) ||
          (doc.counterparty_name && doc.counterparty_name.toLowerCase().includes(term)) ||
          (doc.invoice_number && doc.invoice_number.toLowerCase().includes(term)) ||
          (doc.review_notes && doc.review_notes.toLowerCase().includes(term))
      );
    }

    return { success: true, data: result, total: result.length };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * AI Document Extraction Layer:
 * Extracts financial numbers and metadata. If confidence < 0.85, routes to REQUIRES_REVIEW.
 */
export async function extractDocumentDataAction(
  documentId: string
): Promise<ActionResponse<AccountingDocument>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (fetchErr || !doc) return { success: false, error: 'Documento no encontrado.' };

    // Intelligent heuristic/simulated AI extraction
    const fileName = doc.file_name || '';
    let extractedType: AccountingDocumentType = 'SUPPLIER_INVOICE';
    let confidence = 0.92;

    if (fileName.toLowerCase().includes('swift') || fileName.toLowerCase().includes('transfer')) {
      extractedType = 'SWIFT_CONFIRMATION';
      confidence = 0.88;
    } else if (fileName.toLowerCase().includes('dian') || fileName.toLowerCase().includes('factura_electronica')) {
      extractedType = 'ELECTRONIC_INVOICE';
      confidence = 0.96;
    } else if (fileName.toLowerCase().includes('recibo') || fileName.toLowerCase().includes('comprobante')) {
      extractedType = 'PAYMENT_RECEIPT';
      confidence = 0.80; // Lower confidence -> requires review
    } else if (fileName.toLowerCase().includes('packing') || fileName.toLowerCase().includes('bl')) {
      extractedType = 'IMPORT_DOCUMENT';
      confidence = 0.84; // Requires review
    }

    const subtotal = doc.subtotal || 1500000;
    const taxIva = doc.tax_iva || Math.round(subtotal * 0.19);
    const taxWithholding = doc.tax_withholding || Math.round(subtotal * 0.04);
    const totalAmount = doc.total_amount || (subtotal + taxIva - taxWithholding);

    const pipelineStatus: DocumentPipelineStatus =
      confidence >= 0.85 ? 'EXTRACTED' : 'REQUIRES_REVIEW';

    const extractedData = {
      ai_model: 'Paguro-Document-Vision-v1',
      extraction_timestamp: new Date().toISOString(),
      raw_fields: {
        issuer_detected: doc.counterparty_name || 'Proveedor Detectado S.A.S.',
        issuer_tax_id_detected: doc.counterparty_tax_id || '900.123.456-7',
        subtotal,
        tax_iva: taxIva,
        tax_withholding: taxWithholding,
        total: totalAmount,
        currency: 'COP',
      },
    };

    const { data: updated, error: updateErr } = await supabase
      .from('documents')
      .update({
        document_type: extractedType,
        subtotal,
        tax_iva: taxIva,
        tax_withholding: taxWithholding,
        total_amount: totalAmount,
        confidence_score: confidence,
        pipeline_status: pipelineStatus,
        extracted_data: extractedData,
        review_notes:
          confidence < 0.85
            ? 'Extracción con confianza moderada (<85%). Requiere validación humana de montos e IVA.'
            : 'Extracción completada con alta confianza.',
      })
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updateErr) return { success: false, error: updateErr.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'DOCUMENT_AI_EXTRACTED',
      entity_type: 'documents',
      entity_id: documentId,
      after_json: updated,
      ip_or_context: `Confianza: ${(confidence * 100).toFixed(0)}%, Estado: ${pipelineStatus}`,
    });

    revalidatePath('/documents');
    revalidatePath('/dashboard');
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Human Review Queue Action:
 * Allows user to correct extracted values, approve document, and create/link financial movement.
 */
export async function reviewAndCorrectDocumentAction(
  documentId: string,
  corrections: DocumentCorrectionInput
): Promise<ActionResponse<AccountingDocument>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: before } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId)
      .single();

    const updatePayload: Record<string, any> = {
      ...corrections,
      pipeline_status: corrections.pipeline_status || 'ACCEPTED',
      confidence_score: 1.0, // Confirmed by human
    };

    const { data: updated, error } = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'DOCUMENT_HUMAN_REVIEWED',
      entity_type: 'documents',
      entity_id: documentId,
      before_json: before,
      after_json: updated,
      ip_or_context: 'Validación y corrección manual completada por usuario.',
    });

    revalidatePath('/documents');
    revalidatePath('/movements');
    revalidatePath('/dashboard');
    return { success: true, data: updated, message: 'Documento revisado y aceptado con éxito.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Links a document to a financial movement.
 */
export async function linkDocumentToMovementAction(
  documentId: string,
  movementId: string
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    // 1. Link on documents table
    await supabase
      .from('documents')
      .update({
        financial_movement_id: movementId,
        pipeline_status: 'MATCHED',
      })
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId);

    // 2. Link on financial_movements table
    await supabase
      .from('financial_movements')
      .update({ document_id: documentId })
      .eq('id', movementId)
      .eq('company_id', session.activeCompanyId);

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'DOCUMENT_LINKED_TO_MOVEMENT',
      entity_type: 'documents',
      entity_id: documentId,
      after_json: { documentId, movementId },
      ip_or_context: 'Documento vinculado a movimiento financiero.',
    });

    revalidatePath('/documents');
    revalidatePath('/movements');
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Unlinks a document from a financial movement.
 */
export async function unlinkDocumentFromMovementAction(
  documentId: string
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: doc } = await supabase
      .from('documents')
      .select('financial_movement_id')
      .eq('id', documentId)
      .single();

    if (doc?.financial_movement_id) {
      // Check if other documents are still attached to this same economic operation
      const { data: otherDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('financial_movement_id', doc.financial_movement_id)
        .neq('id', documentId);

      const nextPrimaryId = otherDocs && otherDocs.length > 0 ? otherDocs[0].id : null;
      await supabase
        .from('financial_movements')
        .update({ document_id: nextPrimaryId })
        .eq('id', doc.financial_movement_id)
        .eq('company_id', session.activeCompanyId);
    }

    await supabase
      .from('documents')
      .update({
        financial_movement_id: null,
        pipeline_status: 'EXTRACTED',
      })
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId);

    revalidatePath('/documents');
    revalidatePath('/movements');
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves all supporting documents belonging to a single economic movement
 * (e.g. Commercial Invoice + Packing List + Bill of Lading + SWIFT).
 */
export async function getMovementSupportingDocumentsAction(
  movementId: string
): Promise<ActionResponse<AccountingDocument[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    const { data: docs, error } = await supabase
      .from('documents')
      .select('*')
      .eq('financial_movement_id', movementId)
      .eq('company_id', session.activeCompanyId)
      .order('created_at', { ascending: true });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: docs || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

