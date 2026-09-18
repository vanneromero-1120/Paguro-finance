-- ============================================================================
-- Migration 00007: Add notes and created_by to tax_periods
-- ============================================================================

ALTER TABLE tax_periods 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN tax_periods.notes IS 'Optional notes and accounting observations for this tax period';
COMMENT ON COLUMN tax_periods.created_by IS 'User who created the tax period';
