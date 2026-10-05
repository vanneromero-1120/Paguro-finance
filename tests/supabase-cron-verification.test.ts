// ============================================================================
// Paguro Finance V1 - Supabase Cron & Drive Sync Migration Verification Suite
// Validates:
// 1. Vercel Hobby Compatibility (vercel.json has no cron entries)
// 2. Migration 00012 SQL verification (pg_cron, pg_net, Vault secrets, 15m schedule)
// 3. /api/cron/drive-sync route strict Bearer auth & query-string rejection
// 4. Manual Google Drive sync idempotency and availability
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/cron/drive-sync/route';
import { syncGoogleDriveAccountingDocuments } from '../lib/integrations/google-drive';

describe('Supabase Cron & Drive Sync Migration Verification', () => {
  const rootDir = path.resolve(__dirname, '..');

  // --------------------------------------------------------------------------
  // 1. Vercel Cron Removal & Hobby Plan Compatibility
  // --------------------------------------------------------------------------
  describe('Vercel Hobby Compatibility', () => {
    it('ensures vercel.json contains no cron configurations', () => {
      const vercelConfigPath = path.join(rootDir, 'vercel.json');
      expect(fs.existsSync(vercelConfigPath)).toBe(true);

      const content = fs.readFileSync(vercelConfigPath, 'utf8').trim();
      const parsed = JSON.parse(content || '{}');

      // Vercel Hobby blocks deployments if crons are defined with frequency > 1/day
      expect(parsed.crons).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Supabase Cron Migration (database/00012_supabase_cron_drive_sync.sql)
  // --------------------------------------------------------------------------
  describe('Supabase Cron Migration 00012 Verification', () => {
    const migrationPaths = [
      path.join(rootDir, 'database', '00012_supabase_cron_drive_sync.sql'),
      path.join(rootDir, 'database', 'migrations', '00012_supabase_cron_drive_sync.sql'),
    ];

    it('ensures migration 00012 exists in database directory', () => {
      migrationPaths.forEach((filePath) => {
        expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
      });
    });

    it('verifies pg_cron and pg_net extensions are used correctly', () => {
      migrationPaths.forEach((filePath) => {
        const sql = fs.readFileSync(filePath, 'utf8');

        expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_net;');
        expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_cron;');
        expect(sql).toContain('net.http_get');
        expect(sql).toContain('cron.schedule');
      });
    });

    it('verifies CRON_SECRET is NOT hardcoded and uses Supabase Vault', () => {
      migrationPaths.forEach((filePath) => {
        const sql = fs.readFileSync(filePath, 'utf8');

        // Vault decrypted_secrets lookup for cron_secret
        expect(sql).toContain("FROM vault.decrypted_secrets");
        expect(sql).toContain("WHERE name = 'cron_secret'");

        // No literal hardcoded cron secrets
        expect(sql).not.toMatch(/Bearer\s+[a-zA-Z0-9_\-]{16,}/);
      });
    });

    it('verifies the schedule is exactly */15 * * * *', () => {
      migrationPaths.forEach((filePath) => {
        const sql = fs.readFileSync(filePath, 'utf8');
        expect(sql).toContain("'*/15 * * * *'");
      });
    });

    it('verifies target URL is configurable for production domain via Supabase Vault', () => {
      migrationPaths.forEach((filePath) => {
        const sql = fs.readFileSync(filePath, 'utf8');

        expect(sql).toContain("WHERE name = 'app_production_url'");
        expect(sql).toContain("rtrim(v_url, '/') || '/api/cron/drive-sync'");
      });
    });

    it('verifies safe error handling so missing secrets do not crash the database', () => {
      migrationPaths.forEach((filePath) => {
        const sql = fs.readFileSync(filePath, 'utf8');

        expect(sql).toContain('IF v_url IS NULL OR v_secret IS NULL THEN');
        expect(sql).toContain('RETURN;');
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. /api/cron/drive-sync Endpoint Authentication & Query Parameter Rejection
  // --------------------------------------------------------------------------
  describe('/api/cron/drive-sync Route Authentication', () => {
    const originalEnv = process.env;
    const testSecret = 'test_cron_secret_secure_987654321';

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        CRON_SECRET: testSecret,
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('rejects requests without Authorization header with 401', async () => {
      const req = new NextRequest('https://app.pagurofinance.com/api/cron/drive-sync', {
        method: 'GET',
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('rejects requests with invalid Bearer token with 401', async () => {
      const req = new NextRequest('https://app.pagurofinance.com/api/cron/drive-sync', {
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid_secret_token',
        },
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('strictly rejects query-string authentication attempts (?secret=)', async () => {
      const req = new NextRequest(`https://app.pagurofinance.com/api/cron/drive-sync?secret=${testSecret}`, {
        method: 'GET',
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Query secrets');
    });

    it('strictly rejects query-string authentication attempts (?key=)', async () => {
      const req = new NextRequest(`https://app.pagurofinance.com/api/cron/drive-sync?key=${testSecret}`, {
        method: 'GET',
      });
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Query secrets');
    });

    it('supports POST requests with strict Bearer authentication', async () => {
      const req = new NextRequest('https://app.pagurofinance.com/api/cron/drive-sync', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong_token',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Manual Drive Sync & Idempotency
  // --------------------------------------------------------------------------
  describe('Manual Google Drive Sync & Idempotency', () => {
    it('ensures syncGoogleDriveAccountingDocuments is idempotent on repeated runs', async () => {
      const companyId = 'c-test-idempotency-company';
      const mockDatabase = new Map<string, any>();

      const mockSupabase: any = {
        from: (table: string) => {
          const queryBuilder: any = {
            select: () => queryBuilder,
            insert: (row: any) => {
              mockDatabase.set(row.drive_file_id || row.id, row);
              return queryBuilder;
            },
            update: () => queryBuilder,
            eq: () => queryBuilder,
            single: async () => ({
              data: {
                id: 'conn-test-1',
                company_id: companyId,
                provider: 'GOOGLE_DRIVE',
                status: 'CONNECTED',
                config: { folder_id: 'test-folder', folder_name: 'Facturación' },
              },
              error: null,
            }),
            maybeSingle: async () => ({
              data: null,
              error: null,
            }),
          };
          queryBuilder.then = (resolve: any) => resolve({ data: null, error: null });
          return queryBuilder;
        },
      };

      const testChanges = [
        {
          fileId: 'file-repeatable-001',
          file: {
            id: 'file-repeatable-001',
            name: 'Factura Electrónica FE-500.pdf',
            mimeType: 'application/pdf',
            size: 24500,
            modifiedTime: '2026-03-28T12:00:00Z',
            folderPath: 'Contabilidad/2026/03_MARZO',
          },
        },
      ];

      // Run 1: Ingestion
      const run1 = await syncGoogleDriveAccountingDocuments(companyId, {
        testChanges,
        supabaseClient: mockSupabase,
      });

      expect(run1.success).toBe(true);
      expect(run1.filesIngested).toBe(1);

      // Setup mock to return the existing document on run 2
      const existingDoc = {
        id: 'doc-existing-uuid',
        company_id: companyId,
        drive_file_id: 'file-repeatable-001',
        file_name: 'Factura Electrónica FE-500.pdf',
        drive_folder_path: 'Contabilidad/2026/03_MARZO',
        drive_modified_time: '2026-03-28T12:00:00Z',
        provenance: 'GOOGLE_DRIVE',
        source_status: 'ACTIVE',
      };

      mockSupabase.from = (table: string) => {
        const queryBuilder: any = {
          select: () => queryBuilder,
          insert: () => queryBuilder,
          update: () => queryBuilder,
          eq: () => queryBuilder,
          single: async () => ({
            data: {
              id: 'conn-test-1',
              company_id: companyId,
              provider: 'GOOGLE_DRIVE',
              status: 'CONNECTED',
            },
            error: null,
          }),
          maybeSingle: async () => ({
            data: table === 'documents' ? existingDoc : null,
            error: null,
          }),
        };
        queryBuilder.then = (resolve: any) => resolve({ data: null, error: null });
        return queryBuilder;
      };

      // Run 2: Exact same file with same modifiedTime -> Skipped, 0 duplicates
      const run2 = await syncGoogleDriveAccountingDocuments(companyId, {
        testChanges,
        supabaseClient: mockSupabase,
      });

      expect(run2.success).toBe(true);
      expect(run2.filesIngested).toBe(0);
      expect(run2.filesSkipped).toBe(1);
    });
  });
});
