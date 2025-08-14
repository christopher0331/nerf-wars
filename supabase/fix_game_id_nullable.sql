-- Make game_id nullable in rfid_scans table
-- This allows badge scans to work without requiring an active game

ALTER TABLE rfid_scans ALTER COLUMN game_id DROP NOT NULL;

-- Verify the change
\d rfid_scans;
