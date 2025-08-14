-- Create game_stations table for storing selected stations for each game
CREATE TABLE IF NOT EXISTS public.game_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  game_session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(game_session_id, station_id)
);

-- Add RLS policies
ALTER TABLE public.game_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to game_stations"
  ON public.game_stations
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated insert to game_stations"
  ON public.game_stations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add realtime subscription
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_stations;
