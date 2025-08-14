-- Remove redundant uuid column from stations table
-- The id column already serves as the unique identifier

ALTER TABLE stations DROP COLUMN IF EXISTS uuid;

-- Show current stations with their IDs
SELECT id, name, location FROM stations ORDER BY name;
