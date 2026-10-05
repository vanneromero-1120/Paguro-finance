// ============================================================================
// Paguro Finance V1 - Document Original Preview & Human Validation UX Suite
// Verifies:
// 1. Authorized document preview (Google Drive & Supabase Storage)
// 2. Unauthorized access rejected (401 / 403)
// 3. Multi-tenant company isolation (cross-company access blocked)
// 4. Signed/private URL behavior (no permanent public URLs, inline disposition)
// 5. Validation workflow preserved after preview
// 6. VIEWER role cannot modify validation (read-only enforcement)
// 7. Missing source handled gracefully without destroying accounting records
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as previewRouteHandler } from '../app/api/documents/[id]/preview/route';
import {
  getDocumentPreviewUrlAction,
  reviewAndCorrectDocumentAction,
  resolveDocumentConflictAction,
  getCurrentUserDocumentPermissionsAction,
} from '../lib/actions/documents-v1';
import { getDocumentDownloadUrlAction } from '../lib/actions/documents';
import * as serverAuth from '../lib/auth/server-auth';
import * as serverSupabase from '../lib/supabase/server';
import * as googleDrive from '../lib/integrations/google-drive';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe('Document Original Preview & Human Validation UX Suite', () => {
  const companyA = 'c1111111-1111-1111-1111-111111111111';
  const companyB = 'c2222222-2222-2222-2222-222222222222';
  const userId = 'u1111111-1111-1111-1111-111111111111';

  let mockSession: any;
  let mockSupabase: any;
  let mockStorageSignedUrl: string;
  let mockDriveFileBlob: Buffer;

  beforeEach(() => {
    mockStorageSignedUrl =
      'https://suuwgzrilxoswvrqigbp.supabase.co/storage/v1/object/sign/financial-documents/test.pdf?token=mock_hmac_60s';
    mockDriveFileBlob = Buffer.from('%PDF-1.4 Mock PDF Content For Accounting Document');

    mockSession = {
      id: userId,
      userId: userId,
      email: 'accountant@pagurocorp.com',
      activeCompanyId: companyA,
      activeRole: 'ACCOUNTANT',
      companies: [{ company: { id: companyA }, role: 'ACCOUNTANT' }],
    };

    vi.spyOn(serverAuth, 'getServerAuthSession').mockImplementation(async () => mockSession);

    // Mock Supabase Server Client
    mockSupabase = {
      from: vi.fn((table: string) => {
        const query: any = {
          select: vi.fn(() => query),
          insert: vi.fn(() => query),
          update: vi.fn(() => query),
          eq: vi.fn((field: string, val: any) => {
            query._filters = query._filters || {};
            query._filters[field] = val;
            return query;
          }),
          order: vi.fn(() => query),
          single: vi.fn(async () => {
            const filters = query._filters || {};
            if (table === 'documents') {
              if (filters.id === 'doc-storage-001' && filters.company_id === companyA) {
                return {
                  data: {
                    id: 'doc-storage-001',
                    company_id: companyA,
                    file_name: 'Factura_Proveedor_001.pdf',
                    storage_path: `${companyA}/invoices/inv-1/factura.pdf`,
                    mime_type: 'application/pdf',
                    source_status: 'ACTIVE',
                    pipeline_status: 'REQUIRES_REVIEW',
                    total_amount: 1500000,
                  },
                  error: null,
                };
              }
              if (filters.id === 'doc-drive-001' && filters.company_id === companyA) {
                return {
                  data: {
                    id: 'doc-drive-001',
                    company_id: companyA,
                    file_name: 'SWIFT_Transfer_7852073.pdf',
                    storage_path: 'gdrive/drive-file-abc',
                    drive_file_id: 'drive-file-abc',
                    mime_type: 'application/pdf',
                    source_status: 'ACTIVE',
                    pipeline_status: 'REQUIRES_REVIEW',
                    total_amount: 3200000,
                  },
                  error: null,
                };
              }
              if (filters.id === 'doc-missing-source' && filters.company_id === companyA) {
                return {
                  data: {
                    id: 'doc-missing-source',
                    company_id: companyA,
                    file_name: 'Factura_Eliminada.pdf',
                    storage_path: 'gdrive/drive-deleted-xyz',
                    drive_file_id: 'drive-deleted-xyz',
                    mime_type: 'application/pdf',
                    source_status: 'SOURCE_MISSING',
                    pipeline_status: 'REQUIRES_REVIEW',
                  },
                  error: null,
                };
              }
              // Cross-company document belonging to companyB
              if (filters.id === 'doc-company-b' && filters.company_id === companyB) {
                return {
                  data: {
                    id: 'doc-company-b',
                    company_id: companyB,
                    file_name: 'Documento_Privado_Empresa_B.pdf',
                    storage_path: `${companyB}/invoices/inv-b/privado.pdf`,
                    mime_type: 'application/pdf',
                  },
                  error: null,
                };
              }
            }

            if (table === 'integration_connections') {
              if (filters.company_id === companyA && filters.provider === 'GOOGLE_DRIVE') {
                return {
                  data: {
                    id: 'conn-drive-a',
                    company_id: companyA,
                    provider: 'GOOGLE_DRIVE',
                    status: 'CONNECTED',
                    config: {
                      access_token: 'ya29.mock_google_oauth_token',
                      refresh_token: 'mock_refresh_token',
                    },
                  },
                  error: null,
                };
              }
            }

            return { data: null, error: { message: 'Row not found' } };
          }),
        };
        return query;
      }),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async (path: string, expiresIn: number) => {
            expect(expiresIn).toBeLessThanOrEqual(300); // Short-lived check
            return {
              data: { signedUrl: mockStorageSignedUrl },
              error: null,
            };
          }),
          download: vi.fn(async () => ({
            data: new Blob([new Uint8Array(mockDriveFileBlob)], { type: 'application/pdf' }),
            error: null,
          })),
        })),
      },
    };

    vi.spyOn(serverSupabase, 'createServerSupabaseClient').mockImplementation(() => mockSupabase);

    vi.spyOn(googleDrive, 'getValidAccessToken').mockImplementation(async () => ({
      accessToken: 'ya29.mock_valid_token_123',
    }));

    // Mock global fetch for Google Drive media download
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('googleapis.com/drive/v3/files')) {
        return new Response(new Uint8Array(mockDriveFileBlob), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
          },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Authorized Document Preview
  // --------------------------------------------------------------------------
  describe('1. Authorized Document Preview', () => {
    it('returns preview URL for Google Drive document through the secure streaming route', async () => {
      const res = await getDocumentPreviewUrlAction('doc-drive-001');

      expect(res.success).toBe(true);
      expect(res.data?.source).toBe('GOOGLE_DRIVE');
      expect(res.data?.url).toBe('/api/documents/doc-drive-001/preview');
      expect(res.data?.file_name).toBe('SWIFT_Transfer_7852073.pdf');
    });

    it('returns short-lived signed URL for Supabase Storage document', async () => {
      const res = await getDocumentPreviewUrlAction('doc-storage-001');

      expect(res.success).toBe(true);
      expect(res.data?.source).toBe('STORAGE');
      expect(res.data?.url).toContain('storage/v1/object/sign');
      expect(res.data?.file_name).toBe('Factura_Proveedor_001.pdf');
    });

    it('streams Google Drive document via /api/documents/[id]/preview with inline Content-Disposition', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/doc-drive-001/preview');
      const res = await previewRouteHandler(req, { params: { id: 'doc-drive-001' } });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(res.headers.get('content-disposition')).toContain('inline');
      expect(res.headers.get('cache-control')).toContain('private');
    });

    it('allows VIEWER role to preview documents', async () => {
      mockSession.activeRole = 'VIEWER';

      const res = await getDocumentPreviewUrlAction('doc-drive-001');
      expect(res.success).toBe(true);

      const req = new NextRequest('http://localhost:3000/api/documents/doc-drive-001/preview');
      const routeRes = await previewRouteHandler(req, { params: { id: 'doc-drive-001' } });
      expect(routeRes.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Unauthorized Access Rejection
  // --------------------------------------------------------------------------
  describe('2. Unauthorized Access Rejection', () => {
    it('rejects unauthenticated requests to preview route with 401', async () => {
      vi.spyOn(serverAuth, 'getServerAuthSession').mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/documents/doc-drive-001/preview');
      const res = await previewRouteHandler(req, { params: { id: 'doc-drive-001' } });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('No autorizado');
    });

    it('rejects unauthenticated calls to getDocumentPreviewUrlAction', async () => {
      vi.spyOn(serverAuth, 'getServerAuthSession').mockResolvedValueOnce(null);

      const res = await getDocumentPreviewUrlAction('doc-drive-001');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Sesión no iniciada');
    });

    it('rejects invalid or unauthorized roles with 403', async () => {
      mockSession.activeRole = 'ANONYMOUS_GUEST';

      const req = new NextRequest('http://localhost:3000/api/documents/doc-drive-001/preview');
      const res = await previewRouteHandler(req, { params: { id: 'doc-drive-001' } });

      expect(res.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Multi-Tenant Company Isolation
  // --------------------------------------------------------------------------
  describe('3. Company Isolation', () => {
    it('rejects access to documents belonging to a different company with 404', async () => {
      // User is logged into companyA, but requests document belonging to companyB
      const req = new NextRequest('http://localhost:3000/api/documents/doc-company-b/preview');
      const res = await previewRouteHandler(req, { params: { id: 'doc-company-b' } });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('no pertenece a la empresa activa');
    });

    it('getDocumentPreviewUrlAction blocks cross-company document access', async () => {
      const res = await getDocumentPreviewUrlAction('doc-company-b');

      expect(res.success).toBe(false);
      expect(res.error).toContain('no pertenece a la empresa activa');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Signed & Private URL Behavior (Zero Token Leakage)
  // --------------------------------------------------------------------------
  describe('4. Private URL & Security Behavior', () => {
    it('never leaks Google OAuth access tokens or service keys in client URLs', async () => {
      const res = await getDocumentPreviewUrlAction('doc-drive-001');

      expect(res.success).toBe(true);
      expect(res.data?.url).not.toContain('ya29.');
      expect(res.data?.url).not.toContain('service_role');
      expect(res.data?.url).toBe('/api/documents/doc-drive-001/preview');
    });

    it('getDocumentDownloadUrlAction supports both Drive and Storage transparently', async () => {
      const driveRes = await getDocumentDownloadUrlAction('doc-drive-001');
      expect(driveRes.success).toBe(true);
      expect(driveRes.data?.signed_url).toBe('/api/documents/doc-drive-001/preview');

      const storageRes = await getDocumentDownloadUrlAction('doc-storage-001');
      expect(storageRes.success).toBe(true);
      expect(storageRes.data?.signed_url).toContain('storage/v1/object/sign');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Human Validation Workflow & Audit Preservation
  // --------------------------------------------------------------------------
  describe('5. Validation Workflow & Audit Record', () => {
    it('allows authorized accountant to validate document with audit logging', async () => {
      mockSession.activeRole = 'ACCOUNTANT';

      const updateChain: any = {
        eq: vi.fn(() => updateChain),
        select: vi.fn(() => updateChain),
        single: vi.fn(async () => ({
          data: {
            id: 'doc-drive-001',
            company_id: companyA,
            file_name: 'SWIFT_Transfer_7852073.pdf',
            pipeline_status: 'ACCEPTED',
            provenance: 'USER_VERIFIED',
            total_amount: 3200000,
          },
          error: null,
        })),
      };

      const selectChain: any = {
        select: vi.fn(() => selectChain),
        eq: vi.fn(() => selectChain),
        single: vi.fn(async () => ({
          data: {
            id: 'doc-drive-001',
            company_id: companyA,
            file_name: 'SWIFT_Transfer_7852073.pdf',
            total_amount: 3200000,
          },
          error: null,
        })),
        update: vi.fn(() => updateChain),
      };

      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'documents') {
          return selectChain;
        }
        if (table === 'audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return { select: vi.fn(() => selectChain) };
      });

      const res = await reviewAndCorrectDocumentAction('doc-drive-001', {
        document_type: 'SWIFT_CONFIRMATION',
        total_amount: 3200000,
        review_notes: 'Verificado cotejando con el soporte bancario original.',
      });

      if (!res.success) {
        console.error('FAILED IN TEST 5:', res.error);
      }

      expect(res.success).toBe(true);
      expect(res.data?.pipeline_status).toBe('ACCEPTED');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Viewer Read-Only Enforcement
  // --------------------------------------------------------------------------
  describe('6. VIEWER Read-Only Enforcement', () => {
    it('blocks VIEWER role from validating or modifying financial document metadata', async () => {
      mockSession.activeRole = 'VIEWER';

      const res = await reviewAndCorrectDocumentAction('doc-drive-001', {
        document_type: 'COMMERCIAL_INVOICE',
        total_amount: 999999,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Permiso denegado');
      expect(res.error).toContain('VIEWER');
    });

    it('blocks VIEWER role from resolving document conflicts', async () => {
      mockSession.activeRole = 'VIEWER';

      const res = await resolveDocumentConflictAction('doc-drive-001', 'KEEP_HUMAN_VERIFIED');

      expect(res.success).toBe(false);
      expect(res.error).toContain('Permiso denegado');
      expect(res.error).toContain('VIEWER');
    });

    it('reports canValidate: false for VIEWER and canValidate: true for ADMIN/FINANCE', async () => {
      mockSession.activeRole = 'VIEWER';
      const viewerPerms = await getCurrentUserDocumentPermissionsAction();
      expect(viewerPerms.data?.canValidate).toBe(false);
      expect(viewerPerms.data?.role).toBe('VIEWER');

      mockSession.activeRole = 'FINANCE';
      const financePerms = await getCurrentUserDocumentPermissionsAction();
      expect(financePerms.data?.canValidate).toBe(true);
      expect(financePerms.data?.role).toBe('FINANCE');
    });
  });

  // --------------------------------------------------------------------------
  // 7. Missing Source Handled Gracefully
  // --------------------------------------------------------------------------
  describe('7. Missing Source Handling', () => {
    it('returns a clean user error when source document was removed from Google Drive', async () => {
      const res = await getDocumentPreviewUrlAction('doc-missing-source');

      expect(res.success).toBe(false);
      expect(res.error).toContain('retirado o eliminado de Google Drive');
      expect(res.error).toContain('auditoría');
    });

    it('returns 404 with audit protection notice when previewing removed source', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/doc-missing-source/preview');
      const res = await previewRouteHandler(req, { params: { id: 'doc-missing-source' } });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('retirado o eliminado de Google Drive');
    });
  });
});
