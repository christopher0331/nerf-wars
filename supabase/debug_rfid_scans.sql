-- Debug RFID scans to see what's happening

-- 1. Check if any scans are being inserted
SELECT COUNT(*) as total_scans FROM rfid_scans;

-- 2. Check recent scans
SELECT * FROM rfid_scans ORDER BY scanned_at DESC LIMIT 5;

-- 3. Check if the game_id exists in games table
SELECT * FROM games WHERE id = 'a492f49a-8a95-443c-9d78-0eacb43327b0';

-- 4. Check if the station_id exists in stations table
SELECT * FROM stations WHERE id = '04bc0dd5-a929-40f7-85d4-db99555b21db';

-- 5. Check badges table
SELECT * FROM badges;
