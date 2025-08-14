-- Migration: Simplified KOTH Trigger using station names instead of UUIDs
-- This completely redesigns the trigger to avoid UUID/TEXT conversions entirely

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS process_rfid_scan_trigger ON rfid_scans;

-- Create a much simpler function that uses TEXT comparisons throughout
CREATE OR REPLACE FUNCTION process_rfid_scan()
RETURNS TRIGGER AS $$
DECLARE
  badge_team_id UUID;
  station_name TEXT;
  current_control RECORD;
  now_timestamp TIMESTAMP WITH TIME ZONE := NOW();
  active_session_id UUID;
  active_game_type TEXT;
BEGIN
  RAISE LOG 'Processing scan: station_id=%, uid=%', NEW.station_id, NEW.uid;
  
  -- First, get the station name from its ID or UUID
  SELECT name INTO station_name 
  FROM stations 
  WHERE id::TEXT = NEW.station_id OR uuid = NEW.station_id
  LIMIT 1;
  
  IF station_name IS NULL THEN
    RAISE LOG 'Could not find station with id or uuid: %', NEW.station_id;
    RETURN NEW;
  END IF;
  
  RAISE LOG 'Found station: %', station_name;
  
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
  
  RAISE LOG 'Active game session found: id=%', active_session_id;
  
  -- Get game type from the games table
  SELECT type INTO active_game_type
  FROM games
  WHERE id::TEXT = active_game_type::TEXT;
  
  RAISE LOG 'Game type: %', active_game_type;
  
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
  
  -- SIMPLIFIED: Assume all stations are part of the game during active sessions
  -- This avoids complex UUID/text comparisons with game_stations table
  
  -- Check if there's current control for this station using station name
  SELECT * INTO current_control 
  FROM station_control sc
  JOIN stations s ON sc.station_id = s.id
  WHERE s.name = station_name
    AND sc.game_session_id = active_session_id 
    AND sc.is_current_control = true;
  
  -- If no control exists or different team, create new control
  IF current_control IS NULL OR current_control.team_id != badge_team_id THEN
    -- If there was previous control, end it
    IF current_control IS NOT NULL THEN
      RAISE LOG 'Ending previous control: station=%, team_id=%', station_name, current_control.team_id;
      
      UPDATE station_control 
      SET 
        is_current_control = false,
        control_duration_seconds = EXTRACT(EPOCH FROM (now_timestamp - current_control.controlled_at))::INTEGER
      WHERE id = current_control.id;
    END IF;
    
    RAISE LOG 'Creating new control: station=%, team_id=%', station_name, badge_team_id;
    
    -- Find the station ID from name for insertion
    DECLARE
      insert_station_id UUID;
    BEGIN
      SELECT id INTO insert_station_id FROM stations WHERE name = station_name;
      
      -- Create new control record
      INSERT INTO station_control (
        station_id, team_id, game_session_id, 
        controlled_at, is_current_control, control_duration_seconds
      ) VALUES (
        insert_station_id, badge_team_id, active_session_id,
        now_timestamp, true, 0
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER process_rfid_scan_trigger
AFTER INSERT ON rfid_scans
FOR EACH ROW
EXECUTE FUNCTION process_rfid_scan();

-- Make sure station_control table is in realtime publication
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

-- Display notice about the changes
DO $$
BEGIN
  RAISE NOTICE 'Simplified KOTH trigger installed - using station names instead of UUIDs';
END
$$;
