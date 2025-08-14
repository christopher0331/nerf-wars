-- Create a dummy game record to match the ESP32 firmware
-- This allows the existing firmware to work without modification

-- First make game_id nullable (in case we want to use it later)
ALTER TABLE rfid_scans ALTER COLUMN game_id DROP NOT NULL;

-- Create a dummy game record that matches the ESP32 firmware
INSERT INTO games (id, name, type, duration_minutes, status) 
VALUES (
    'a492f49a-8a95-443c-9d78-0eacb43327b0',
    'Default Game',
    'king_of_the_hill',
    10,
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Verify the game exists
SELECT * FROM games WHERE id = 'a492f49a-8a95-443c-9d78-0eacb43327b0';
