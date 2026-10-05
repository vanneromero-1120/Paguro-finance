-- ============================================================================
-- Migration 00012: Supabase Cron (pg_cron + pg_net + Supabase Vault)
-- 15-Minute Continuous Google Drive Synchronization Scheduler
-- Replaces Vercel Hobby cron limitations with native PostgreSQL serverless scheduling
-- ============================================================================

-- 1. Enable Required Serverless HTTP & Scheduler Extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Note: supabase_vault extension is pre-installed in Supabase projects.
-- Secrets are securely managed in vault.secrets and accessed decrypted via vault.decrypted_secrets.

-- 2. Create the Trigger Function
-- Securely retrieves production domain and CRON_SECRET from Supabase Vault
-- and dispatches an asynchronous HTTP request with Bearer authorization.
CREATE OR REPLACE FUNCTION public.trigger_drive_sync_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net, extensions
AS $$
DECLARE
    v_url TEXT;
    v_secret TEXT;
    v_target_endpoint TEXT;
    v_headers JSONB;
BEGIN
    -- 1. Retrieve production app URL from Supabase Vault
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'app_production_url'
    LIMIT 1;

    -- 2. Retrieve cron secret from Supabase Vault
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'cron_secret'
    LIMIT 1;

    -- Safety Check: If secrets are not yet configured in Vault, exit safely without crashing
    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE NOTICE '[trigger_drive_sync_cron] Vault secrets (app_production_url or cron_secret) not configured. Skipping scheduled invocation.';
        RETURN;
    END IF;

    -- 3. Construct target endpoint: https://<domain>/api/cron/drive-sync
    v_target_endpoint := rtrim(v_url, '/') || '/api/cron/drive-sync';

    -- 4. Construct strict Bearer authorization headers
    v_headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type', 'application/json',
        'User-Agent', 'PaguroFinance-SupabaseCron/1.0'
    );

    -- 5. Invoke via pg_net async HTTP GET
    PERFORM net.http_get(
        url := v_target_endpoint,
        headers := v_headers,
        timeout_milliseconds := 60000
    );
END;
$$;

-- 3. Register or Update the 15-Minute Scheduled Cron Job
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'paguro-drive-sync-15min') THEN
        PERFORM cron.unschedule('paguro-drive-sync-15min');
    END IF;
END $$;

SELECT cron.schedule(
    'paguro-drive-sync-15min',
    '*/15 * * * *',
    'SELECT public.trigger_drive_sync_cron();'
);

-- ============================================================================
-- Supabase Vault Configuration Guide:
--
-- In production, the user configures the two secrets securely using SQL or
-- the Supabase Dashboard (Project Settings -> Vault):
--
-- 1. Store Production Domain:
--    SELECT vault.create_secret('https://<your-vercel-domain>.vercel.app', 'app_production_url', 'Paguro Finance Production App Domain');
--
-- 2. Store CRON_SECRET:
--    SELECT vault.create_secret('<your-production-cron-secret>', 'cron_secret', 'Bearer secret for /api/cron/drive-sync');
--
-- Once configured, Supabase pg_cron will automatically trigger the drive-sync endpoint
-- every 15 minutes, independent of Vercel plan limits or local computer state.
-- ============================================================================
