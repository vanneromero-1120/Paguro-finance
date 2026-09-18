// ============================================================================
// Paguro Finance - Private Financial Document Storage Architecture
// ============================================================================
// SECURITY SPECIFICATION:
// 1. All financial documents (invoices, expenses, tax returns, payment receipts)
//    are stored in the strictly PRIVATE Supabase Storage bucket: 'financial-documents'.
// 2. Public URLs are strictly prohibited. Files are accessible exclusively through
//    short-lived cryptographically signed URLs (default: 300s / 5 minutes).
// 3. File storage paths follow a multi-tenant hierarchy:
//    {company_id}/{entity_type}/{entity_id}/{timestamp}_{sanitized_filename}
// ============================================================================

import { createServerSupabaseClient } from '@/lib/supabase/server';

export type FinancialEntityType =
  | 'invoices'
  | 'expenses'
  | 'payments'
  | 'customers'
  | 'suppliers'
  | 'tax_periods';

export const FINANCIAL_DOCUMENTS_BUCKET = 'financial-documents';

export interface DocumentUploadParams {
  companyId: string;
  entityType: FinancialEntityType;
  entityId: string;
  fileName: string;
  fileBuffer: Blob | Buffer | Uint8Array;
  mimeType: string;
  fileSizeBytes: number;
  userId?: string;
  notes?: string;
}

export interface UploadResult {
  success: boolean;
  documentId?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Uploads a financial attachment into the private tenant-isolated bucket
 * and registers metadata in the `documents` table.
 */
export async function uploadFinancialDocument(
  params: DocumentUploadParams
): Promise<UploadResult> {
  const {
    companyId,
    entityType,
    entityId,
    fileName,
    fileBuffer,
    mimeType,
    fileSizeBytes,
    userId,
    notes,
  } = params;

  const supabase = createServerSupabaseClient();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${companyId}/${entityType}/${entityId}/${Date.now()}_${sanitizedName}`;

  if (!supabase) {
    return {
      success: false,
      error: 'Servicio de almacenamiento Supabase no configurado.',
    };
  }

  // 1. Upload to private Supabase Storage bucket
  const { error: uploadError } = await supabase.storage
    .from(FINANCIAL_DOCUMENTS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  // 2. Register metadata in the database `documents` table
  const { data: docRecord, error: dbError } = await supabase
    .from('documents')
    .insert({
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
      file_name: fileName,
      file_path: storagePath,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      uploaded_by: userId || null,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (dbError) {
    // Rollback storage upload if DB insert fails
    await supabase.storage.from(FINANCIAL_DOCUMENTS_BUCKET).remove([storagePath]);
    return { success: false, error: dbError.message };
  }

  return {
    success: true,
    documentId: docRecord.id,
    storagePath,
  };
}

/**
 * Generates a short-lived cryptographically signed download URL for private documents.
 * Never returns permanent public URLs.
 */
export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds: number = 300
): Promise<{ signedUrl: string | null; error?: string }> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return {
      signedUrl: null,
      error: 'Servicio de almacenamiento Supabase no configurado.',
    };
  }

  const { data, error } = await supabase.storage
    .from(FINANCIAL_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return {
      signedUrl: null,
      error: error?.message || 'No se pudo generar la URL segura de descarga.',
    };
  }

  return {
    signedUrl: data.signedUrl,
  };
}

/**
 * Deletes a financial document from both storage and the database catalog.
 */
export async function deleteFinancialDocument(
  documentId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return { success: true };
  }

  // 1. Remove from Supabase Storage
  const { error: storageError } = await supabase.storage
    .from(FINANCIAL_DOCUMENTS_BUCKET)
    .remove([storagePath]);

  if (storageError) {
    return { success: false, error: storageError.message };
  }

  // 2. Remove from database
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (dbError) {
    return { success: false, error: dbError.message };
  }

  return { success: true };
}
