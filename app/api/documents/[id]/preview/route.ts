// ============================================================================
// Paguro Finance V1 - Secure Document Original Preview Endpoint
// Multi-company isolated, Role-checked (VIEWER+), Streamed inline PDF/image preview
// Supports both private Supabase Storage and authenticated Google Drive files
// Never exposes OAuth tokens, service keys, or public permanent URLs to the client
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import { getValidAccessToken } from '@/lib/integrations/google-drive';

export const dynamic = 'force-dynamic';

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const documentId = params?.id;
  if (!documentId) {
    return NextResponse.json(
      { error: 'ID de documento no especificado.' },
      { status: 400 }
    );
  }

  // 1. Authenticate user session
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json(
      { error: 'No autorizado: Inicie sesión para visualizar este documento.' },
      { status: 401 }
    );
  }

  // 2. Validate role authorization (VIEWER is permitted to read)
  if (!READ_ROLES.includes(session.activeRole)) {
    return NextResponse.json(
      { error: 'Permiso denegado: Su rol no tiene autorización para consultar documentos.' },
      { status: 403 }
    );
  }

  // 3. Database client
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Servicio de base de datos no disponible.' },
      { status: 503 }
    );
  }

  try {
    // 4. Query document strictly within user's active company (Company Isolation)
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (docErr || !doc) {
      return NextResponse.json(
        { error: 'Documento no encontrado o no pertenece a la empresa activa.' },
        { status: 404 }
      );
    }

    // 5. Check if document source was removed / missing
    if (doc.source_status === 'SOURCE_MISSING' || doc.source_status === 'REMOVED_FROM_DRIVE') {
      return NextResponse.json(
        { error: 'El archivo original fue retirado o eliminado de Google Drive. El soporte contable se conserva por auditoría.' },
        { status: 404 }
      );
    }

    const isGoogleDrive = Boolean(
      doc.drive_file_id || (doc.storage_path && doc.storage_path.startsWith('gdrive/'))
    );

    // ------------------------------------------------------------------------
    // CASE A: GOOGLE DRIVE SOURCE
    // ------------------------------------------------------------------------
    if (isGoogleDrive) {
      const driveFileId =
        doc.drive_file_id ||
        (doc.storage_path ? doc.storage_path.replace(/^gdrive\//, '') : null);

      if (!driveFileId) {
        return NextResponse.json(
          { error: 'Referencia de archivo Google Drive no encontrada en metadatos.' },
          { status: 404 }
        );
      }

      // Retrieve Google Drive OAuth connection for the active company
      const { data: connection, error: connErr } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('company_id', session.activeCompanyId)
        .eq('provider', 'GOOGLE_DRIVE')
        .single();

      if (connErr || !connection || connection.status === 'NOT_CONFIGURED') {
        return NextResponse.json(
          { error: 'Google Drive no está conectado ni autorizado para esta empresa.' },
          { status: 502 }
        );
      }

      const tokenRes = await getValidAccessToken(supabase, session.activeCompanyId, connection);
      if (!tokenRes.accessToken) {
        return NextResponse.json(
          { error: 'La sesión de Google Drive ha expirado o requiere reconexión.' },
          { status: 502 }
        );
      }

      // Fetch file content from Google Drive API securely on server side
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${tokenRes.accessToken}`,
          },
        }
      );

      if (!driveRes.ok) {
        const errText = await driveRes.text();
        console.error('[DocumentPreviewAPI] Google Drive fetch failed:', driveRes.status, errText);
        if (driveRes.status === 404) {
          return NextResponse.json(
            { error: 'El archivo no fue encontrado en Google Drive.' },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: 'Error al obtener el archivo desde Google Drive.' },
          { status: 502 }
        );
      }

      const mimeType = doc.mime_type || driveRes.headers.get('content-type') || 'application/pdf';
      const cleanFileName = encodeURIComponent(doc.file_name || 'documento.pdf');

      return new Response(driveRes.body, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${cleanFileName}"`,
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      });
    }

    // ------------------------------------------------------------------------
    // CASE B: SUPABASE STORAGE SOURCE
    // ------------------------------------------------------------------------
    if (doc.storage_path) {
      // Stream file directly with inline disposition so browser renders it without downloading
      const { data: fileBlob, error: dlErr } = await supabase.storage
        .from('financial-documents')
        .download(doc.storage_path);

      if (dlErr || !fileBlob) {
        // Fallback: Generate short-lived signed URL
        const { data: signedData, error: signErr } = await supabase.storage
          .from('financial-documents')
          .createSignedUrl(doc.storage_path, 60);

        if (!signErr && signedData?.signedUrl) {
          return NextResponse.redirect(signedData.signedUrl, 307);
        }

        return NextResponse.json(
          { error: 'No se pudo acceder al archivo en el almacenamiento privado.' },
          { status: 404 }
        );
      }

      const mimeType = doc.mime_type || 'application/pdf';
      const cleanFileName = encodeURIComponent(doc.file_name || 'documento.pdf');

      return new Response(fileBlob, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${cleanFileName}"`,
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        },
      });
    }

    return NextResponse.json(
      { error: 'El documento no cuenta con una fuente de almacenamiento registrada.' },
      { status: 404 }
    );
  } catch (err: any) {
    console.error('[DocumentPreviewAPI] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar la vista previa del documento.' },
      { status: 500 }
    );
  }
}
