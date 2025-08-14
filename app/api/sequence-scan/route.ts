import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// Sequence Game Types
interface SequenceGameConfig {
  game_id: string
  mode: 'FREE' | 'ORDERED'
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

interface TeamProgress {
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

interface ScanResponse {
  ok: boolean
  team_id: string
  event: 'PROGRESS' | 'WRONG_ORDER' | 'DEFENDER_LOCK' | 'ALREADY_DONE' | 'WIN' | 'HOLDING'
  team_progress: TeamProgress
  station_feedback: {
    led_color: 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'white'
    blink_ms: number
  }
  broadcast?: {
    type: 'state_update'
    payload: any
  }
}

export async function POST(request: NextRequest) {
  try {
    const { scan_id, game_id, station_id, rfid_uid, scanned_at } = await request.json()

    if (!scan_id || !game_id || !station_id || !rfid_uid) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('🎯 Sequence scan received:', { scan_id, game_id, station_id, rfid_uid })

    // Check for idempotency - if scan_id already exists, return cached response
    const { data: existingScan } = await supabase
      .from('sequence_scans')
      .select('*')
      .eq('scan_id', scan_id)
      .single()

    if (existingScan) {
      console.log('🔄 Returning cached response for scan:', scan_id)
      return NextResponse.json(existingScan.response)
    }

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('badges')
      .select('*, teams(*)')
      .eq('rfid_uid', rfid_uid)
      .single()

    if (playerError || !player || !player.team_id) {
      console.log('❌ Unknown player or unassigned badge:', rfid_uid)
      return NextResponse.json({ error: 'Unknown player or unassigned badge' }, { status: 400 })
    }

    const team_id = player.team_id
    const team = player.teams

    // Get game config (for now, use a default config - in production this would be stored)
    const gameConfig: SequenceGameConfig = {
      game_id,
      mode: 'ORDERED',
      sequence: ['Station 1', 'Station 2', 'Station 3'], // Default sequence
      multi_scan: { 'Station 1': 1, 'Station 2': 1, 'Station 3': 1 },
      time_window_sec: 60,
      wrong_scan_penalty: { type: 'reset_to_zero' },
      defender_reset: { mode: 'lock_current', cooldown_sec: 15 },
      win_rule: { type: 'first_to_finish' },
      max_duration_sec: 600
    }

    // Get or create team progress
    let { data: progress, error: progressError } = await supabase
      .from('sequence_team_progress')
      .select('*')
      .eq('game_id', game_id)
      .eq('team_id', team_id)
      .single()

    if (progressError || !progress) {
      // Create initial progress
      const { data: newProgress, error: createError } = await supabase
        .from('sequence_team_progress')
        .insert({
          game_id,
          team_id,
          idx: 0,
          points: 0,
          last_update: new Date().toISOString(),
          meta: { visited: [], streak_count: 0 }
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating team progress:', createError)
        return NextResponse.json({ error: 'Failed to create team progress' }, { status: 500 })
      }
      progress = newProgress
    }

    // Check for station locks
    const { data: lock } = await supabase
      .from('sequence_station_locks')
      .select('*')
      .eq('game_id', game_id)
      .eq('station_id', station_id)
      .gt('locked_until', new Date().toISOString())
      .single()

    if (lock && lock.locked_by_team !== team_id) {
      const response: ScanResponse = {
        ok: true,
        team_id,
        event: 'DEFENDER_LOCK',
        team_progress: progress,
        station_feedback: { led_color: 'purple', blink_ms: 600 }
      }

      // Log the scan
      await logScan(scan_id, game_id, station_id, rfid_uid, team_id, 'DEFENDER_LOCK', response)
      return NextResponse.json(response)
    }

    // Handle the scan based on game mode
    let outcome: 'PROGRESS' | 'WRONG_ORDER' | 'ALREADY_DONE' | 'WIN' | 'HOLDING'
    let updatedProgress = { ...progress }

    if (gameConfig.mode === 'ORDERED') {
      outcome = handleOrderedModeScan(gameConfig, station_id, updatedProgress)
    } else {
      outcome = handleFreeModeScan(gameConfig, station_id, updatedProgress)
    }

    // Check for win condition
    if (checkWinCondition(gameConfig, updatedProgress)) {
      outcome = 'WIN'
    }

    // Update progress in database
    const { error: updateError } = await supabase
      .from('sequence_team_progress')
      .update({
        idx: updatedProgress.idx,
        points: updatedProgress.points,
        window_expires_at: updatedProgress.window_expires_at,
        last_update: new Date().toISOString(),
        meta: updatedProgress.meta
      })
      .eq('game_id', game_id)
      .eq('team_id', team_id)

    if (updateError) {
      console.error('Error updating progress:', updateError)
    }

    // Generate response
    const response: ScanResponse = {
      ok: true,
      team_id,
      event: outcome,
      team_progress: updatedProgress,
      station_feedback: getStationFeedback(outcome, team?.color || '#00ffff'),
      broadcast: {
        type: 'state_update',
        payload: { team_id, station_id, outcome, progress: updatedProgress }
      }
    }

    // Log the scan
    await logScan(scan_id, game_id, station_id, rfid_uid, team_id, outcome, response)

    console.log('✅ Sequence scan processed:', { team_id, station_id, outcome })
    return NextResponse.json(response)

  } catch (error) {
    console.error('Sequence scan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function handleOrderedModeScan(
  config: SequenceGameConfig,
  station_id: string,
  progress: TeamProgress
): 'PROGRESS' | 'WRONG_ORDER' | 'HOLDING' {
  const sequence = config.sequence
  const targetStation = sequence[progress.idx]

  // Check if scanning wrong station
  if (station_id !== targetStation) {
    // Apply penalty
    if (config.wrong_scan_penalty.type === 'reset_to_zero') {
      progress.idx = 0
      progress.meta = { ...progress.meta, streak_count: 0 }
      progress.window_expires_at = undefined
    }
    return 'WRONG_ORDER'
  }

  // Check multi-scan requirement
  const needed = config.multi_scan[station_id] || 1
  const currentStreak = (progress.meta?.streak_count || 0) + 1

  if (currentStreak >= needed) {
    // Station completed
    progress.idx += 1
    progress.meta = { ...progress.meta, streak_count: 0 }
    
    // Set time window for next station if configured
    if (config.time_window_sec && progress.idx < sequence.length) {
      const windowEnd = new Date()
      windowEnd.setSeconds(windowEnd.getSeconds() + config.time_window_sec)
      progress.window_expires_at = windowEnd.toISOString()
    }
    
    return 'PROGRESS'
  } else {
    // Need more scans
    progress.meta = { ...progress.meta, streak_count: currentStreak }
    return 'HOLDING'
  }
}

function handleFreeModeScan(
  config: SequenceGameConfig,
  station_id: string,
  progress: TeamProgress
): 'PROGRESS' | 'ALREADY_DONE' {
  const visited = new Set(progress.meta?.visited || [])
  
  if (visited.has(station_id)) {
    return 'ALREADY_DONE'
  }
  
  visited.add(station_id)
  progress.meta = { ...progress.meta, visited: Array.from(visited) }
  progress.points = visited.size
  
  return 'PROGRESS'
}

function checkWinCondition(config: SequenceGameConfig, progress: TeamProgress): boolean {
  if (config.win_rule.type === 'first_to_finish') {
    if (config.mode === 'ORDERED') {
      return progress.idx >= config.sequence.length
    } else {
      // FREE mode - check if all stations visited
      const visited = new Set(progress.meta?.visited || [])
      return visited.size >= config.sequence.length // Assuming sequence contains all active stations
    }
  }
  return false
}

function getStationFeedback(outcome: string, teamColor: string): { led_color: any, blink_ms: number } {
  switch (outcome) {
    case 'PROGRESS':
      return { led_color: 'green', blink_ms: 1000 }
    case 'HOLDING':
      return { led_color: 'yellow', blink_ms: 300 }
    case 'WRONG_ORDER':
      return { led_color: 'red', blink_ms: 600 }
    case 'DEFENDER_LOCK':
      return { led_color: 'purple', blink_ms: 600 }
    case 'WIN':
      return { led_color: 'green', blink_ms: 2000 }
    case 'ALREADY_DONE':
      return { led_color: 'white', blink_ms: 200 }
    default:
      return { led_color: 'blue', blink_ms: 500 }
  }
}

async function logScan(
  scan_id: string,
  game_id: string,
  station_id: string,
  rfid_uid: string,
  team_id: string,
  outcome: string,
  response: ScanResponse
) {
  try {
    await supabase
      .from('sequence_scans')
      .insert({
        scan_id,
        game_id,
        station_id,
        rfid_uid,
        team_id,
        outcome,
        ts: new Date().toISOString(),
        response
      })
  } catch (error) {
    console.error('Error logging scan:', error)
  }
}
