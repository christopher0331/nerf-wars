import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Team {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface Badge {
  id: string
  rfid_uid: string
  player_name?: string
  team_id?: string
  created_at: string
  updated_at: string
}

export interface Station {
  id: string
  uuid: string
  name: string
  location?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Game {
  id: string
  name: string
  type: string
  duration_minutes: number
  status: string
  created_at: string
  updated_at: string
}

export interface GameSession {
  id: string
  game_id: string
  start_time?: string
  end_time?: string
  winner_team_id?: string
  status: string
  created_at: string
  updated_at: string
}

export interface RfidScan {
  id: string
  game_id?: string
  station_id: string
  uid: string
  game_session_id?: string
  scanned_at: string
}

export interface StationControl {
  id: string
  station_id: string
  team_id: string
  game_session_id: string
  controlled_at: string
  control_duration_seconds: number
  is_current_control: boolean
}

export interface GameStation {
  id: string
  game_id: string
  station_id: string
  game_session_id: string
  created_at: string
}

// Sequence Game Types
export interface SequenceGame {
  game_id: string
  mode: 'FREE' | 'ORDERED'
  config: {
    sequence: string[]
    multi_scan: Record<string, number>
    time_window_sec?: number
    wrong_scan_penalty: {
      type: 'reset_to_zero' | 'time_penalty' | 'none'
      seconds?: number
    }
    defender_reset: {
      mode: 'lock_last' | 'lock_current'
      cooldown_sec: number
    }
    win_rule: {
      type: 'first_to_finish' | 'most_points_when_time_ends'
    }
    max_duration_sec: number
  }
  status: 'pending' | 'active' | 'ended'
  started_at?: string
  ended_at?: string
  created_at: string
  updated_at: string
}

export interface SequenceTeamProgress {
  game_id: string
  team_id: string
  idx: number
  points: number
  window_expires_at?: string
  last_update: string
  meta?: {
    visited?: string[]
    streak_count?: number
    cooldown_until?: string
  }
}

export interface SequenceScan {
  scan_id: string
  game_id: string
  station_id: string
  rfid_uid: string
  team_id: string
  outcome: 'PROGRESS' | 'WRONG_ORDER' | 'DEFENDER_LOCK' | 'ALREADY_DONE' | 'WIN' | 'HOLDING'
  ts: string
  meta?: any
  response?: any
}

export interface SequenceStationLock {
  game_id: string
  station_id: string
  locked_by_team: string
  locked_until: string
  created_at: string
}
