-- Add quantity column to shopping table
-- Run this in Supabase SQL Editor

-- Add quantity column with default value 1
ALTER TABLE shopping ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Set existing items to quantity 1
UPDATE shopping SET quantity = 1 WHERE quantity IS NULL;

-- Make quantity required (not null)
ALTER TABLE shopping ALTER COLUMN quantity SET NOT NULL;

-- Add check constraint to ensure quantity is positive
ALTER TABLE shopping ADD CONSTRAINT quantity_positive CHECK (quantity > 0);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS shopping_quantity_idx ON shopping(quantity);
