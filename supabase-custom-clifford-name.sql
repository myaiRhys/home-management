-- Add custom_clifford_name column to households table
-- This allows each household to customize the "Clifford" label to their child's name

-- Add the column with default value
ALTER TABLE households ADD COLUMN IF NOT EXISTS custom_clifford_name TEXT DEFAULT 'Clifford';

-- Update existing households to use the default
UPDATE households
SET custom_clifford_name = 'Clifford'
WHERE custom_clifford_name IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN households.custom_clifford_name IS 'Custom name for the child care category (defaults to "Clifford")';
