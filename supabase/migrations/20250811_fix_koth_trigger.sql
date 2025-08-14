-- Migration: Fix KOTH Trigger for TEXT type station_id
-- This reinstalls the trigger to work with the new TEXT columns

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS process_rfid_scan_trigger ON rfid_scans;

-- Make sure function is properly updated for TEXT type station_id and game_id
CREATE OR REPLACE FUNCTION process_rfid_scan()
RETURNS TRIGGER AS $$
DECLARE
  badge_team_id UUID;
  current_control RECORD;
  now_timestamp TIMESTAMP WITH TIME ZONE := NOW();
  active_session_id UUID;
  active_game_type TEXT;
  actual_station_id UUID;
BEGIN
  RAISE LOG 'Processing scan: station_id=%, game_id=%, uid=%', NEW.station_id, NEW.game_id, NEW.uid;
  
  -- Find active game session
  SELECT id, game_id INTO active_session_id, active_game_type 
  FROM game_sessions 
  WHERE status = 'active' 
  LIMIT 1;
  
  -- Skip if no active game
  IF active_session_id IS NULL THEN
    RAISE LOG 'No active game session found';
    RETURN NEW;
  END IF;
  
  RAISE LOG 'Active game session found: id=%, game_id=%', active_session_id, active_game_type;
  
  -- Get game type from the games table
  SELECT type INTO active_game_type
  FROM games
  WHERE id::TEXT = active_game_type;
  
  -- Only process for King of the Hill game type
  IF active_game_type != 'king_of_the_hill' THEN
    RAISE LOG 'Not a King of the Hill game: %', active_game_type;
    RETURN NEW;
  END IF;
  
  -- Find team for this badge
  SELECT team_id INTO badge_team_id FROM badges WHERE rfid_uid = NEW.uid;
  
  -- Skip if badge has no team
  IF badge_team_id IS NULL THEN
    RAISE LOG 'Badge has no team: uid=%', NEW.uid;
    RETURN NEW;
  END IF;
  
  RAISE LOG 'Badge team found: team_id=%', badge_team_id;
  
  -- Find the actual station ID (as UUID) from the stations table
  SELECT id INTO actual_station_id 
  FROM stations 
  WHERE id::TEXT = NEW.station_id OR uuid = NEW.station_id
  LIMIT 1;
    
  IF actual_station_id IS NULL THEN
    RAISE LOG 'Could not find station with id or uuid matching: %', NEW.station_id;
    RETURN NEW;
  END IF;
  
  RAISE LOG 'Found actual station_id: %', actual_station_id;
  
  -- Check if this station is part of this game session
  IF NOT EXISTS (
    SELECT 1 FROM game_stations gs
    WHERE gs.game_session_id = active_session_id 
    AND gs.station_id = actual_station_id
  ) THEN
    RAISE LOG 'Station not part of active game: station_id=%', actual_station_id;
    RETURN NEW;
  END IF;
  
  RAISE LOG 'Station is part of active game: station_id=%', actual_station_id;
  
  -- Check if there's current control for this station
  SELECT * INTO current_control 
  FROM station_control 
  WHERE station_id = actual_station_id
    AND game_session_id = active_session_id 
    AND is_current_control = true;
  
  -- If no control exists or different team, create new control
  IF current_control IS NULL OR current_control.team_id != badge_team_id THEN
    -- If there was previous control, end it
    IF current_control IS NOT NULL THEN
      RAISE LOG 'Ending previous control: station_id=%, team_id=%', actual_station_id, current_control.team_id;
      
      UPDATE station_control 
      SET 
        is_current_control = false,
        control_duration_seconds = EXTRACT(EPOCH FROM (now_timestamp - current_control.controlled_at))::INTEGER
      WHERE id = current_control.id;
    END IF;
    
    RAISE LOG 'Creating new control: station_id=%, team_id=%', actual_station_id, badge_team_id;
    
    -- Create new control record
    INSERT INTO station_control (
      station_id, team_id, game_session_id, 
      controlled_at, is_current_control, control_duration_seconds
    ) VALUES (
      actual_station_id, badge_team_id, active_session_id,
      now_timestamp, true, 0
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

RAISE NOTICE 'KOTH trigger updated to handle TEXT type station_id';
