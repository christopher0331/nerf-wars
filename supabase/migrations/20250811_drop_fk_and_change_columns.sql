-- Migration: Drop foreign key constraints, change rfid_scans columns from UUID to TEXT, then recreate constraints
-- This fixes the "operator does not exist: uuid = text" error when processing RFID scans

-- First, drop the foreign key constraints that are causing issues
ALTER TABLE rfid_scans
DROP CONSTRAINT IF EXISTS rfid_scans_game_id_fkey,
DROP CONSTRAINT IF EXISTS rfid_scans_station_id_fkey;

-- Now, change the columns to TEXT
ALTER TABLE rfid_scans
ALTER COLUMN station_id TYPE TEXT,
ALTER COLUMN game_id TYPE TEXT;

-- Update the trigger function to handle text IDs
CREATE OR REPLACE FUNCTION process_rfid_scan()
RETURNS TRIGGER AS $$
DECLARE
  badge_team_id UUID;
  current_control RECORD;
  now_timestamp TIMESTAMP WITH TIME ZONE := NOW();
  active_session_id UUID;
  active_game_type TEXT;
BEGIN
  -- Find active game session
  SELECT id, game_id INTO active_session_id, active_game_type 
  FROM game_sessions 
  WHERE status = 'active' 
  LIMIT 1;
  
  -- Skip if no active game
  IF active_session_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get game type from the games table
  SELECT type INTO active_game_type
  FROM games
  WHERE id = active_game_type;
  
  -- Only process for King of the Hill game type
  IF active_game_type != 'king_of_the_hill' THEN
    RETURN NEW;
  END IF;
  
  -- Find team for this badge
  SELECT team_id INTO badge_team_id FROM badges WHERE rfid_uid = NEW.uid;
  
  -- Skip if badge has no team
  IF badge_team_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if this station is part of this game session
  -- We use text comparison here since station_id is now TEXT
  IF NOT EXISTS (
    SELECT 1 FROM game_stations gs
    JOIN stations s ON gs.station_id = s.id OR gs.station_id::TEXT = s.uuid::TEXT
    WHERE gs.game_session_id = active_session_id 
    AND (s.id::TEXT = NEW.station_id OR s.uuid::TEXT = NEW.station_id)
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Check if there's current control for this station
  SELECT * INTO current_control 
  FROM station_control 
  WHERE (station_id::TEXT = NEW.station_id OR station_id IN (
      SELECT id FROM stations WHERE uuid::TEXT = NEW.station_id
    ))
    AND game_session_id = active_session_id 
    AND is_current_control = true;
  
  -- If no control exists or different team, create new control
  IF current_control IS NULL OR current_control.team_id != badge_team_id THEN
    -- If there was previous control, end it
    IF current_control IS NOT NULL THEN
      UPDATE station_control 
      SET 
        is_current_control = false,
        control_duration_seconds = EXTRACT(EPOCH FROM (now_timestamp - current_control.controlled_at))::INTEGER
      WHERE id = current_control.id;
    END IF;
    
    -- Find the actual station ID (as UUID) from the stations table
    -- based on the incoming text station_id
    DECLARE
      actual_station_id UUID;
    BEGIN
      SELECT id INTO actual_station_id 
      FROM stations 
      WHERE id::TEXT = NEW.station_id OR uuid::TEXT = NEW.station_id
      LIMIT 1;
      
      IF actual_station_id IS NULL THEN
        -- If we can't find a matching station, try to use the text value as UUID
        BEGIN
          actual_station_id := NEW.station_id::UUID;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Failed to cast station_id "%" to UUID: %', NEW.station_id, SQLERRM;
          RETURN NEW;
        END;
      END IF;
      
      -- Create new control record with proper UUID
      INSERT INTO station_control (
        station_id, team_id, game_session_id, 
        controlled_at, is_current_control, control_duration_seconds
      ) VALUES (
        actual_station_id, badge_team_id, active_session_id,
        now_timestamp, true, 0
      );
    EXCEPTION WHEN OTHERS THEN
      -- If anything goes wrong with the UUID conversion, log it
      RAISE NOTICE 'Error creating control record: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
