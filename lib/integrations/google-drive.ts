// ============================================================================
// Paguro Finance V1 - Google Drive Document Ingestion Architecture
// OAuth Flow, Idempotent Discovery (Sept 2025+), Document Pipeline & Error Handling
// ============================================================================

import { createServerSupabaseClient } from '../supabase/server';
import { AccountingDocumentType } from '../../types/v1-financial';

export interface GoogleDriveConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  folderId?: string;
  syncFromDate?: string; // Defaults to '2025-09-01T00:00:00Z'
}

export interface DiscoveredDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime: string;
  webContentLink?: string;
  webViewLink?: string;
  folderPath?: string;
}

/**
 * Returns Google Drive OAuth authorization URL.
 * Redirects to Google consent screen for offline drive.readonly access.
 */
export function getGoogleOAuthUrl(state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
      : 'http://localhost:3000/api/auth/google/callback');

  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID no está configurado en las variables de entorno.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
  });

  if (state) {
    params.set('state', state);
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges authorization code for Google access and refresh tokens.
 */
export async function exchangeGoogleAuthCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
      : 'http://localhost:3000/api/auth/google/callback');

  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de Google OAuth incompletas en variables de entorno.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error canjeando código de autorización Google: ${errorText}`);
  }

  return res.json();
}

/**
 * Infers accounting document type from file name and MIME type.
 */
export function classifyDriveDocument(fileName: string, mimeType: string): AccountingDocumentType {
  const lower = fileName.toLowerCase();
  const normalized = lower.replace(/[-_.]/g, ' ');

  if (normalized.includes('factura') || normalized.includes('invoice') || normalized.includes('fe ') || lower.endsWith('.xml')) {
    return 'ELECTRONIC_INVOICE';
  }
  if (normalized.includes('swift') || normalized.includes('transferencia') || normalized.includes('comprobante pago')) {
    return 'SWIFT_CONFIRMATION';
  }
  if (normalized.includes('recibo') || normalized.includes('receipt') || normalized.includes('pago')) {
    return 'PAYMENT_RECEIPT';
  }
  if (normalized.includes('extracto') || normalized.includes('bancolombia') || normalized.includes('statement')) {
    return 'BANK_STATEMENT';
  }
  if (normalized.includes('packing') || normalized.includes('empaque')) {
    return 'PACKING_LIST';
  }
  if (normalized.includes('bill of lading') || normalized.includes('lading') || normalized.includes('conocimiento') || normalized.includes('bl ')) {
    return 'BILL_OF_LADING';
  }
  if (normalized.includes('declaracion') || normalized.includes('importacion') || normalized.includes('arancel')) {
    return 'IMPORT_DOCUMENT';
  }
  if (normalized.includes('dian') || normalized.includes('iva') || normalized.includes('retencion') || normalized.includes('form ')) {
    return 'TAX_DOCUMENT';
  }

  return 'OTHER_SUPPORT';
}

/**
 * Main Google Drive synchronization execution engine.
 * Idempotent: checks google_drive_file_id before inserting or updating.
 */
export async function syncGoogleDriveAccountingDocuments(
  companyId: string,
  options?: { folderId?: string; syncFromDate?: string }
): Promise<{
  success: boolean;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
  filesDiscovered: number;
  filesIngested: number;
  filesSkipped: number;
  message: string;
  error?: string;
}> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      status: 'ERROR',
      filesDiscovered: 0,
      filesIngested: 0,
      filesSkipped: 0,
      message: 'Base de datos Supabase no disponible.',
    };
  }

  // 1. Inspect integration credentials in database
  const { data: connection } = await supabase
    .from('integration_connections')
    .select('*')
    .eq('company_id', companyId)
    .eq('provider', 'GOOGLE_DRIVE')
    .single();

  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const dbAccessToken = connection?.config?.access_token;

  if (!envClientId || !envClientSecret) {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      filesDiscovered: 0,
      filesIngested: 0,
      filesSkipped: 0,
      message: 'NOT CONFIGURED — USER AUTHORIZATION REQUIRED (Faltan variables GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en .env.local).',
    };
  }

  if (!dbAccessToken) {
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      filesDiscovered: 0,
      filesIngested: 0,
      filesSkipped: 0,
      message: 'NOT CONFIGURED — USER AUTHORIZATION REQUIRED (El usuario debe autorizar su cuenta de Google Drive en /integrations).',
    };
  }

  // 2. Real Google Drive API Query (Incremental from September 2025 onwards)
  const syncFrom = options?.syncFromDate || '2025-09-01T00:00:00Z';
  const query = `trashed = false and modifiedTime >= '${syncFrom}'`;

  try {
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,webContentLink,webViewLink)&pageSize=100`,
      {
        headers: {
          Authorization: `Bearer ${dbAccessToken}`,
        },
      }
    );

    if (!driveRes.ok) {
      if (driveRes.status === 401) {
        await supabase
          .from('integration_connections')
          .update({
            status: 'NEEDS_ATTENTION',
            error_summary: 'Token de acceso expirado. Requiere re-autorización en /integrations.',
          })
          .eq('company_id', companyId)
          .eq('provider', 'GOOGLE_DRIVE');

        return {
          success: false,
          status: 'ERROR',
          filesDiscovered: 0,
          filesIngested: 0,
          filesSkipped: 0,
          message: 'Token de Google Drive expirado. Requiere re-autorización.',
        };
      }
      throw new Error(`Google Drive API error: ${await driveRes.text()}`);
    }

    const driveData = await driveRes.json();
    const driveFiles: DiscoveredDriveFile[] = driveData.files || [];

    let ingested = 0;
    let skipped = 0;

    for (const file of driveFiles) {
      // Idempotency: verify if file already exists in documents
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('company_id', companyId)
        .eq('google_drive_file_id', file.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const docType = classifyDriveDocument(file.name, file.mimeType);

      // Insert new document into pipeline
      const { error: insertErr } = await supabase.from('documents').insert({
        company_id: companyId,
        file_name: file.name,
        storage_path: `gdrive/${file.id}`,
        mime_type: file.mimeType || 'application/octet-stream',
        file_size_bytes: file.size ? Number(file.size) : 0,
        status: 'ACTIVE',
        google_drive_file_id: file.id,
        drive_folder_path: options?.folderId ? `gdrive_folder_${options.folderId}` : 'Accounting/Sept-2025-onward',
        document_type: docType,
        pipeline_status: 'INGESTED',
        confidence_score: null,
      });

      if (!insertErr) {
        ingested++;
      }
    }

    return {
      success: true,
      status: 'CONNECTED',
      filesDiscovered: driveFiles.length,
      filesIngested: ingested,
      filesSkipped: skipped,
      message: `Sincronización completada. ${ingested} documentos nuevos importados, ${skipped} sin cambios.`,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'ERROR',
      filesDiscovered: 0,
      filesIngested: 0,
      filesSkipped: 0,
      message: err.message || 'Error desconocido sincronizando Google Drive.',
      error: err.message,
    };
  }
}
