// ============================================================================
// Paguro Finance - Documents Server Actions
// Multi-company isolated, Private Supabase Storage, Signed URLs, Audit trail
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  DocumentAttachment,
  DocumentEntityType,
  DocumentFilterInput,
  AttachableEntity,
} from '@/types/database';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Retrieves all documents for the user's active company with optional filters.
 */
export async function getDocumentsAction(
  filters?: DocumentFilterInput
): Promise<ActionResponse<DocumentAttachment[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar documentos.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .order('uploaded_at', { ascending: false });

    if (filters?.entity_type && filters.entity_type !== 'all') {
      query = query.eq('entity_type', filters.entity_type);
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    } else {
      query = query.eq('status', 'active');
    }

    if (filters?.date_from) {
      query = query.gte('uploaded_at', `${filters.date_from}T00:00:00.000Z`);
    }

    if (filters?.date_to) {
      query = query.lte('uploaded_at', `${filters.date_to}T23:59:59.999Z`);
    }

    const { data: rawDocs, error: docsErr } = await query;
    if (docsErr) {
      console.error('[getDocumentsAction] Error fetching documents:', docsErr);
      return { success: false, error: 'Error al consultar documentos de la base de datos.', data: [] };
    }

    let docs: DocumentAttachment[] = rawDocs || [];

    // Filter by search string if specified
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      docs = docs.filter(
        (d) =>
          d.file_name.toLowerCase().includes(term) ||
          (d.notes && d.notes.toLowerCase().includes(term))
      );
    }

    // Fetch uploader profiles
    const uploaderIds = Array.from(new Set(docs.map((d) => d.uploaded_by).filter(Boolean))) as string[];
    let profileMap = new Map<string, string>();
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uploaderIds);
      if (profiles) {
        profileMap = new Map(profiles.map((p) => [p.id, p.full_name || 'Usuario']));
      }
    }

    // Enrich documents with display labels
    const enrichedDocs = docs.map((d) => ({
      ...d,
      uploader_name: d.uploaded_by ? profileMap.get(d.uploaded_by) || 'Sistema' : 'Sistema',
    }));

    return { success: true, data: enrichedDocs };
  } catch (err: any) {
    console.error('[getDocumentsAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado.', data: [] };
  }
}

/**
 * Uploads a document to private Supabase Storage and records metadata in database.
 */
export async function uploadDocumentAction(
  formData: FormData
): Promise<ActionResponse<DocumentAttachment>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado. Se requiere rol de administración o finanzas para cargar documentos.' };
  }

  const file = formData.get('file') as File | null;
  const entityType = formData.get('entity_type') as DocumentEntityType | null;
  const entityId = formData.get('entity_id') as string | null;
  const notes = (formData.get('notes') as string | null) || '';

  if (!file) {
    return { success: false, error: 'No se ha adjuntado ningún archivo.' };
  }

  if (!entityType || !entityId) {
    return { success: false, error: 'Debe especificar el tipo y la entidad asociada.' };
  }

  // File type validation
  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      success: false,
      error: `Tipo de archivo no permitido (${mimeType}). Formatos aceptados: PDF, JPG, PNG.`,
    };
  }

  // File size validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: `El archivo supera el tamaño máximo permitido de 15 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // Verify target entity belongs to active company
    let entityVerified = false;
    if (entityType === 'sales_invoice') {
      const { data } = await supabase
        .from('sales_invoices')
        .select('id')
        .eq('id', entityId)
        .eq('company_id', session.activeCompanyId)
        .single();
      entityVerified = !!data;
    } else if (entityType === 'purchase_document' || entityType === 'expense') {
      const { data } = await supabase
        .from('purchase_documents')
        .select('id')
        .eq('id', entityId)
        .eq('company_id', session.activeCompanyId)
        .single();
      entityVerified = !!data;
    } else if (entityType === 'payment') {
      const { data } = await supabase
        .from('payments')
        .select('id')
        .eq('id', entityId)
        .eq('company_id', session.activeCompanyId)
        .single();
      entityVerified = !!data;
    } else if (entityType === 'customer') {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('id', entityId)
        .eq('company_id', session.activeCompanyId)
        .single();
      entityVerified = !!data;
    } else if (entityType === 'supplier') {
      const { data } = await supabase
        .from('suppliers')
        .select('id')
        .eq('id', entityId)
        .eq('company_id', session.activeCompanyId)
        .single();
      entityVerified = !!data;
    } else if (entityType === 'tax_period') {
      const { data } = await supabase
        .from('tax_periods')
        .select('id')
        .eq('id', entityId)
        .eq('company_id', session.activeCompanyId)
        .single();
      entityVerified = !!data;
    }

    if (!entityVerified) {
      return {
        success: false,
        error: 'La entidad seleccionada no existe o no pertenece a la empresa activa.',
      };
    }

    // Build safe storage path: {company_id}/{entity_type}/{entity_id}/{timestamp}_{filename}
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${session.activeCompanyId}/${entityType}/${entityId}/${Date.now()}_${cleanFileName}`;

    // Upload to private Supabase Storage bucket 'financial-documents'
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from('financial-documents')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[uploadDocumentAction] Storage upload error:', uploadErr);
      return { success: false, error: `Error al almacenar el archivo: ${uploadErr.message}` };
    }

    // Insert metadata into documents table
    const { data: newDoc, error: insertErr } = await supabase
      .from('documents')
      .insert({
        company_id: session.activeCompanyId,
        entity_type: entityType,
        entity_id: entityId,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: mimeType,
        file_size_bytes: file.size,
        version: 1,
        status: 'active',
        notes: notes.trim() || null,
        uploaded_by: session.id,
      })
      .select()
      .single();

    if (insertErr || !newDoc) {
      console.error('[uploadDocumentAction] DB insert error:', insertErr);
      // Attempt cleanup from storage
      await supabase.storage.from('financial-documents').remove([storagePath]);
      return { success: false, error: `Error al registrar el documento en la base de datos: ${insertErr?.message}` };
    }

    // Write audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'DOCUMENT_UPLOAD',
      entity_type: 'documents',
      entity_id: newDoc.id,
      after_json: {
        file_name: file.name,
        entity_type: entityType,
        entity_id: entityId,
        file_size_bytes: file.size,
        storage_path: storagePath,
      },
    });

    revalidatePath('/documents');
    return { success: true, data: newDoc, message: 'Documento cargado y resguardado exitosamente.' };
  } catch (err: any) {
    console.error('[uploadDocumentAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado durante la carga.' };
  }
}

/**
 * Generates a short-lived (60 seconds) signed URL to securely view or download a document.
 */
export async function getDocumentDownloadUrlAction(
  documentId: string
): Promise<ActionResponse<{ signed_url: string; file_name: string; mime_type: string }>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para acceder al documento.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch document metadata ensuring company isolation
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (docErr || !doc) {
      return { success: false, error: 'Documento no encontrado o no pertenece a la empresa activa.' };
    }

    const isGoogleDrive = Boolean(
      doc.drive_file_id || (doc.storage_path && doc.storage_path.startsWith('gdrive/'))
    );

    if (isGoogleDrive) {
      return {
        success: true,
        data: {
          signed_url: `/api/documents/${doc.id}/preview`,
          file_name: doc.file_name,
          mime_type: doc.mime_type || 'application/pdf',
        },
      };
    }

    // 2. Generate short-lived signed URL (60-second expiration)
    const { data: signedData, error: signErr } = await supabase.storage
      .from('financial-documents')
      .createSignedUrl(doc.storage_path, 60);

    if (signErr || !signedData?.signedUrl) {
      console.error('[getDocumentDownloadUrlAction] Sign URL error:', signErr);
      return { success: false, error: 'Error al generar enlace seguro de descarga.' };
    }

    return {
      success: true,
      data: {
        signed_url: signedData.signedUrl,
        file_name: doc.file_name,
        mime_type: doc.mime_type,
      },
    };
  } catch (err: any) {
    console.error('[getDocumentDownloadUrlAction] Exception:', err);
    return { success: false, error: err.message || 'Error al obtener enlace de descarga.' };
  }
}

/**
 * Archives a document safely (soft delete).
 */
export async function archiveDocumentAction(
  documentId: string
): Promise<ActionResponse<void>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado. Se requiere rol de administración o finanzas para archivar documentos.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (fetchErr || !doc) {
      return { success: false, error: 'Documento no encontrado o no pertenece a la empresa activa.' };
    }

    const { error: updateErr } = await supabase
      .from('documents')
      .update({ status: 'archived' })
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId);

    if (updateErr) {
      return { success: false, error: `Error al archivar documento: ${updateErr.message}` };
    }

    // Write audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'DOCUMENT_ARCHIVE',
      entity_type: 'documents',
      entity_id: documentId,
      before_json: { status: doc.status },
      after_json: { status: 'archived' },
    });

    revalidatePath('/documents');
    return { success: true, message: 'Documento archivado exitosamente.' };
  } catch (err: any) {
    console.error('[archiveDocumentAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado al archivar documento.' };
  }
}

/**
 * Returns a list of attachable entities of a given type for the user's active company.
 */
export async function getAttachableEntitiesAction(
  entityType: DocumentEntityType
): Promise<ActionResponse<AttachableEntity[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    const entities: AttachableEntity[] = [];

    if (entityType === 'sales_invoice') {
      const { data } = await supabase
        .from('sales_invoices')
        .select('id, invoice_number, total, issue_date')
        .eq('company_id', session.activeCompanyId)
        .order('issue_date', { ascending: false })
        .limit(50);
      if (data) {
        data.forEach((inv) => {
          entities.push({
            id: inv.id,
            entity_type: 'sales_invoice',
            label: `Factura ${inv.invoice_number}`,
            sublabel: `$${Number(inv.total).toLocaleString('es-CO')} (${inv.issue_date})`,
            date: inv.issue_date,
          });
        });
      }
    } else if (entityType === 'purchase_document' || entityType === 'expense') {
      const { data } = await supabase
        .from('purchase_documents')
        .select('id, document_number, total, document_date')
        .eq('company_id', session.activeCompanyId)
        .order('document_date', { ascending: false })
        .limit(50);
      if (data) {
        data.forEach((p) => {
          entities.push({
            id: p.id,
            entity_type: entityType,
            label: `Gasto / Factura ${p.document_number}`,
            sublabel: `$${Number(p.total).toLocaleString('es-CO')} (${p.document_date})`,
            date: p.document_date,
          });
        });
      }
    } else if (entityType === 'payment') {
      const { data } = await supabase
        .from('payments')
        .select('id, reference_number, amount, payment_date')
        .eq('company_id', session.activeCompanyId)
        .order('payment_date', { ascending: false })
        .limit(50);
      if (data) {
        data.forEach((pm) => {
          entities.push({
            id: pm.id,
            entity_type: 'payment',
            label: `Pago Ref. ${pm.reference_number || pm.id.slice(0, 8)}`,
            sublabel: `$${Number(pm.amount).toLocaleString('es-CO')} (${pm.payment_date})`,
            date: pm.payment_date,
          });
        });
      }
    } else if (entityType === 'customer') {
      const { data } = await supabase
        .from('customers')
        .select('id, name, tax_id')
        .eq('company_id', session.activeCompanyId)
        .order('name', { ascending: true })
        .limit(50);
      if (data) {
        data.forEach((c) => {
          entities.push({
            id: c.id,
            entity_type: 'customer',
            label: c.name,
            sublabel: `NIT: ${c.tax_id || 'N/A'}`,
          });
        });
      }
    } else if (entityType === 'supplier') {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, tax_id')
        .eq('company_id', session.activeCompanyId)
        .order('name', { ascending: true })
        .limit(50);
      if (data) {
        data.forEach((s) => {
          entities.push({
            id: s.id,
            entity_type: 'supplier',
            label: s.name,
            sublabel: `NIT: ${s.tax_id || 'N/A'}`,
          });
        });
      }
    } else if (entityType === 'tax_period') {
      const { data } = await supabase
        .from('tax_periods')
        .select('id, tax_type, period_start, period_end')
        .eq('company_id', session.activeCompanyId)
        .order('period_start', { ascending: false })
        .limit(50);
      if (data) {
        data.forEach((tp) => {
          entities.push({
            id: tp.id,
            entity_type: 'tax_period',
            label: `Periodo ${tp.tax_type}`,
            sublabel: `${tp.period_start} al ${tp.period_end}`,
          });
        });
      }
    }

    return { success: true, data: entities };
  } catch (err: any) {
    console.error('[getAttachableEntitiesAction] Exception:', err);
    return { success: false, error: err.message || 'Error al obtener entidades.', data: [] };
  }
}
