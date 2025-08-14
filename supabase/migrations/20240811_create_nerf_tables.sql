-- =====================================================
-- NERF Games System - Complete Database Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TEAMS TABLE
-- =====================================================
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL, -- Hex color code like #FF0000
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- BADGES TABLE
-- =====================================================
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfid_uid VARCHAR(50) NOT NULL UNIQUE, -- RFID UID like "04 A1 B2 C3"
    player_name VARCHAR(100), -- Optional player name
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STATIONS TABLE
-- =====================================================
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uuid VARCHAR(100) NOT NULL UNIQUE, -- Station UUID from ESP32
    name VARCHAR(100) NOT NULL, -- Human-readable name like "Station 1"
    location VARCHAR(200), -- Optional location description
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- GAMES TABLE
-- =====================================================
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'king_of_the_hill', -- game type
    duration_minutes INTEGER NOT NULL DEFAULT 10,
    status VARCHAR(20) DEFAULT 'setup', -- setup, active, paused, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- GAME SESSIONS TABLE
-- =====================================================
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, active, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- RFID SCANS TABLE (for ESP32 data)
-- =====================================================
CREATE TABLE rfid_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    station_id VARCHAR(100) NOT NULL, -- Station UUID from ESP32
    uid VARCHAR(50) NOT NULL, -- RFID UID from ESP32
    game_session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STATION CONTROL TABLE (for game logic)
-- =====================================================
CREATE TABLE station_control (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    controlled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    control_duration_seconds INTEGER DEFAULT 0, -- How long they held it
    is_current_control BOOLEAN DEFAULT true -- Is this the current control?
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================
CREATE INDEX idx_badges_rfid_uid ON badges(rfid_uid);
CREATE INDEX idx_badges_team_id ON badges(team_id);
CREATE INDEX idx_stations_uuid ON stations(uuid);
CREATE INDEX idx_rfid_scans_station_id ON rfid_scans(station_id);
CREATE INDEX idx_rfid_scans_uid ON rfid_scans(uid);
CREATE INDEX idx_rfid_scans_game_session ON rfid_scans(game_session_id);
CREATE INDEX idx_station_control_session ON station_control(game_session_id);
CREATE INDEX idx_station_control_current ON station_control(is_current_control);

-- =====================================================
-- SAMPLE DATA (for testing)
-- =====================================================

-- Insert your existing stations
INSERT INTO stations (uuid, name, location) VALUES 
('04bc0dd5-a929-40f7-85d4-db99555b21db', 'Station 1', 'Main Area'),
('e8a06b61-7a9e-4252-8606-cd6ebcc9f396', 'Station 3', 'Side Area');

-- Insert a sample game
INSERT INTO games (id, name, type, duration_minutes) VALUES 
('a492f49a-8a95-443c-9d78-0eacb43327b0', 'Test Game', 'king_of_the_hill', 10);

-- =====================================================
-- FUNCTIONS for automatic timestamp updates
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_badges_updated_at BEFORE UPDATE ON badges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
