-- ============================================================================
-- Migration 00009: Add Contact and Address Fields to Companies
-- Supports enterprise profile management, billing addresses, and corporate contact
-- ============================================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Update RLS: Ensure company members can select, and only admins can update
-- (The existing pol_companies_update already restricts updates to company admins)
