-- Debug queries for KOTH trigger

-- Check for active game sessions
SELECT * FROM game_sessions 
WHERE status = 'active';

-- Check game stations for active session
SELECT gs.*, s.name as station_name, s.uuid as station_uuid
FROM game_stations gs
JOIN game_sessions gs2 ON gs.game_session_id = gs2.id
JOIN stations s ON gs.station_id = s.id
WHERE gs2.status = 'active';

-- Check recent RFID scans
SELECT * FROM rfid_scans
ORDER BY created_at DESC
LIMIT 10;

-- Check station control records
SELECT sc.*, s.name as station_name, t.name as team_name
FROM station_control sc
JOIN stations s ON sc.station_id = s.id OR sc.station_id = s.uuid
LEFT JOIN teams t ON sc.team_id = t.id
WHERE sc.is_current_control = true
ORDER BY sc.controlled_at DESC;

-- Check badges with team assignments
SELECT b.*, t.name as team_name
FROM badges b
LEFT JOIN teams t ON b.team_id = t.id
ORDER BY b.created_at DESC
LIMIT 20;

-- Debug: Check station IDs to see if they match
SELECT 
  s.id as db_id, 
  s.uuid as uuid_field,
  'Station matches firmware: ' || 
  CASE 
    WHEN s.uuid = '04bc0dd5-a929-40f7-85d4-db99555b21db' OR s.id = '04bc0dd5-a929-40f7-85d4-db99555b21db' THEN 'Station 1' 
    WHEN s.uuid = 'e8a06b61-7a9e-4252-8606-cd6ebcc9f396' OR s.id = 'e8a06b61-7a9e-4252-8606-cd6ebcc9f396' THEN 'Station 3'
    ELSE 'No match'
  END as match_status,
  s.name,
  s.location
FROM stations s;
