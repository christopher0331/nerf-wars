-- Migration: KOTH Control Trigger
-- Creates a trigger to automatically process RFID scans and update station control status for King of the Hill gameplay

-- First create the function that will process the scans
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
  -- Note: We check both the regular station id and the uuid field to handle possible mismatches
  IF NOT EXISTS (
    SELECT 1 FROM game_stations gs
    JOIN stations s ON gs.station_id = s.id OR gs.station_id = s.uuid
    WHERE gs.game_session_id = active_session_id 
    AND (s.id = NEW.station_id OR s.uuid = NEW.station_id)
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Check if there's current control for this station
  SELECT * INTO current_control 
  FROM station_control 
  WHERE (station_id = NEW.station_id OR station_id IN (
      SELECT uuid FROM stations WHERE id = NEW.station_id
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
    
    -- Create new control record
    INSERT INTO station_control (
      station_id, team_id, game_session_id, 
      controlled_at, is_current_control, control_duration_seconds
    ) VALUES (
      NEW.station_id, badge_team_id, active_session_id,
      now_timestamp, true, 0
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS process_rfid_scan_trigger ON rfid_scans;

-- Create the trigger
CREATE TRIGGER process_rfid_scan_trigger
AFTER INSERT ON rfid_scans
FOR EACH ROW
EXECUTE FUNCTION process_rfid_scan();

-- Add the station_control table to the realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'station_control'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.station_control;
  END IF;
END
$$;
