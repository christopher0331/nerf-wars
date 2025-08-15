import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { rfid_uid, station_id } = body

    if (!rfid_uid || !station_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`Processing station control: Badge ${rfid_uid} at Station ${station_id}`)

    // Get active game session
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('status', 'active')
      .single()

    if (sessionError) {
      console.error('No active game session found', sessionError)
      return NextResponse.json({ error: 'No active game session found' }, { status: 404 })
    }

    const gameSessionId = sessionData.id
    const gameId = sessionData.game_id

    // Check if this station is part of the active game
    const { data: gameStationData, error: gameStationError } = await supabase
      .from('game_stations')
      .select('id')
      .eq('game_session_id', gameSessionId)
      .eq('station_id', station_id)
      .single()

    // If station is not part of this game, ignore the scan
    if (gameStationError) {
      console.log(`Station ${station_id} is not part of active game ${gameSessionId}`)
      return NextResponse.json({ error: 'Station not part of active game' }, { status: 400 })
    }

    // Find the team associated with this RFID badge
    const { data: badgeData, error: badgeError } = await supabase
      .from('badges')
      .select('team_id')
      .eq('rfid_uid', rfid_uid)
      .single()

    if (badgeError || !badgeData || !badgeData.team_id) {
      console.error('Badge not assigned to any team', badgeError || 'No team_id')
      return NextResponse.json({ error: 'Badge not assigned to any team' }, { status: 400 })
    }

    const teamId = badgeData.team_id

    // Record the scan
    const { error: scanError } = await supabase
      .from('rfid_scans')
      .insert({
        uid: rfid_uid,
        station_id,
        game_id: gameId,
        game_session_id: gameSessionId
      })

    if (scanError) {
      console.error('Error recording scan', scanError)
      return NextResponse.json({ error: 'Error recording scan' }, { status: 500 })
    }

    // Check if there's an active control for this station
    const { data: controlData, error: controlError } = await supabase
      .from('station_control')
      .select('*')
      .eq('station_id', station_id)
      .eq('game_session_id', gameSessionId)
      .eq('is_current_control', true)
      .single()

    const now = new Date()
    const controlledAt = now.toISOString()

    // If there's no current control, or it's controlled by a different team
    if (controlError || (controlData && controlData.team_id !== teamId)) {
      // If there was a previous control, end it and calculate duration
      if (controlData) {
        const previousControlStart = new Date(controlData.controlled_at)
        const controlDurationSeconds = Math.floor((now.getTime() - previousControlStart.getTime()) / 1000)

        // Update the previous control record
        const { error: updateError } = await supabase
          .from('station_control')
          .update({
            is_current_control: false,
            control_duration_seconds: controlDurationSeconds
          })
          .eq('id', controlData.id)

        if (updateError) {
          console.error('Error updating previous control', updateError)
          return NextResponse.json({ error: 'Error updating previous control' }, { status: 500 })
        }
      }

      // Create a new control record for this team
      const { error: insertError } = await supabase
        .from('station_control')
        .insert({
          station_id,
          team_id: teamId,
          game_session_id: gameSessionId,
          controlled_at: controlledAt,
          control_duration_seconds: 0,
          is_current_control: true
        })

      if (insertError) {
        console.error('Error creating new control', insertError)
        return NextResponse.json({ error: 'Error creating new control' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Station ${station_id} is now controlled by Team ${teamId}`,
        status: 'changed'
      })
    } else if (controlData && controlData.team_id === teamId) {
      // Station already controlled by this team, just acknowledge
      return NextResponse.json({
        success: true,
        message: `Station ${station_id} is already controlled by Team ${teamId}`,
        status: 'unchanged'
      })
    }

    // Should never reach here
    return NextResponse.json({ error: 'Unexpected state' }, { status: 500 })
  } catch (error: any) {
    console.error('Station control error:', error)
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 })
  }
}
