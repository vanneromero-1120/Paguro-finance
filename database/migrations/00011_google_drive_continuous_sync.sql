-- ============================================================================
-- Paguro Finance - Migration 00011: Google Drive Continuous Sync, Provenance & Conflict Tracking
-- ============================================================================

-- 1. Extend documents table for continuous sync, version tracking & provenance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'drive_modified_time') THEN
        ALTER TABLE public.documents ADD COLUMN drive_modified_time TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'drive_version') THEN
        ALTER TABLE public.documents ADD COLUMN drive_version TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'drive_md5_checksum') THEN
        ALTER TABLE public.documents ADD COLUMN drive_md5_checksum TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'last_synced_at') THEN
        ALTER TABLE public.documents ADD COLUMN last_synced_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'source_status') THEN
        ALTER TABLE public.documents ADD COLUMN source_status TEXT DEFAULT 'ACTIVE' CHECK (source_status IN ('ACTIVE', 'SOURCE_MISSING', 'REMOVED_FROM_DRIVE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'provenance') THEN
        ALTER TABLE public.documents ADD COLUMN provenance TEXT DEFAULT 'GOOGLE_DRIVE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'user_verified_fields') THEN
        ALTER TABLE public.documents ADD COLUMN user_verified_fields JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'verified_at') THEN
        ALTER TABLE public.documents ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'verified_by') THEN
        ALTER TABLE public.documents ADD COLUMN verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'conflict_details') THEN
        ALTER TABLE public.documents ADD COLUMN conflict_details JSONB;
    END IF;
END $$;

-- 2. Index for continuous sync queries & idempotency
CREATE INDEX IF NOT EXISTS idx_documents_company_drive_file ON public.documents(company_id, drive_file_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_status ON public.documents(company_id, source_status);
CREATE INDEX IF NOT EXISTS idx_documents_provenance ON public.documents(company_id, provenance);

-- 3. Update financial_movements source_type check constraint to support GOOGLE_DRIVE
ALTER TABLE public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_source_type_check;
ALTER TABLE public.financial_movements ADD CONSTRAINT financial_movements_source_type_check
    CHECK (source_type IN ('GOOGLE_DRIVE', 'BANK', 'PAYMENT_PLATFORM', 'ACCOUNTING_DOCUMENT', 'MANUAL', 'IMPORT', 'SYSTEM'));
