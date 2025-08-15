import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {

    // Parse the JSON body from the ESP32
    const body = await request.json()
    
    // Extract the data
    const { game_id, station_id, uid } = body

    console.log('[SCAN_API] Received scan:', { game_id, station_id, uid })
    
    // Convert string UUIDs to proper UUIDs by passing them as strings
    // Supabase will handle the conversion in the query
    
    // First, insert into rfid_scans with proper type conversion
    const { data: scanData, error: scanError } = await supabase
      .from('rfid_scans')
      .insert({
        station_id: station_id,  // PostgreSQL will convert string to UUID
        game_id: game_id,        // PostgreSQL will convert string to UUID
        uid: uid
      })
      .select()
    
    if (scanError) {
      console.error('[SCAN_API] Error inserting scan:', scanError)
      return NextResponse.json({ 
        error: scanError.message || 'Error inserting scan'
      }, { status: 500 })
    }

    // Find the team for this badge
    const { data: badgeData, error: badgeError } = await supabase
      .from('badges')
      .select('team_id')
      .eq('rfid_uid', uid)
      .single()
    
    if (badgeError && badgeError.code !== 'PGRST116') {
      console.error('[SCAN_API] Error looking up badge:', badgeError)
      return NextResponse.json({ success: true, message: 'Scan recorded, no team found for badge' })
    }
    
    // If no team is assigned, just record the scan
    if (!badgeData?.team_id) {
      return NextResponse.json({ success: true, message: 'Scan recorded, badge has no team' })
    }
    
    // Find active game session
    const { data: sessionData, error: sessionError } = await supabase
      .from('game_sessions')
      .select('id, game_id')
      .eq('status', 'active')
      .single()
    
    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json({ success: true, message: 'Scan recorded, no active game session' })
      }
      
      console.error('[SCAN_API] Error finding active session:', sessionError)
      return NextResponse.json({ success: true, message: 'Scan recorded, error finding game session' })
    }
    
    // Get game type
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('type')
      .eq('id', sessionData.game_id)
      .single()
    
    if (gameError || gameData.type !== 'king_of_the_hill') {
      return NextResponse.json({ success: true, message: 'Scan recorded, not a King of the Hill game' })
    }
    
    // Check if station is part of this game
    const { data: gameStationData, error: gameStationError } = await supabase
      .from('game_stations')
      .select('*')
      .eq('game_session_id', sessionData.id)
      .or(`station_id.eq.${station_id}`)
      .single()
    
    if (gameStationError) {
      return NextResponse.json({ success: true, message: 'Scan recorded, station not part of active game' })
    }
    
    // Check current control
    const { data: controlData, error: controlError } = await supabase
      .from('station_control')
      .select('*')
      .eq('station_id', station_id)
      .eq('game_session_id', sessionData.id)
      .eq('is_current_control', true)
      .single()
    
    const now = new Date()
    
    // If control exists and same team, do nothing
    if (controlData && controlData.team_id === badgeData.team_id) {
      return NextResponse.json({ 
        success: true, 
        message: `Scan recorded, station ${station_id} already controlled by team ${badgeData.team_id}`
      })
    }
    
    // If different team or no control, update control
    
    // End previous control if exists
    if (controlData) {
      const controlDuration = Math.floor((now.getTime() - new Date(controlData.controlled_at).getTime()) / 1000)
      
      const { error: updateError } = await supabase
        .from('station_control')
        .update({
          is_current_control: false,
          control_duration_seconds: controlDuration
        })
        .eq('id', controlData.id)
      
      if (updateError) {
        console.error('[SCAN_API] Error ending previous control:', updateError)
      }
    }
    
    // Create new control
    const { error: insertError } = await supabase
      .from('station_control')
      .insert({
        station_id: station_id,
        team_id: badgeData.team_id,
        game_session_id: sessionData.id,
        controlled_at: now.toISOString(),
        is_current_control: true,
        control_duration_seconds: 0
      })
    
    if (insertError) {
      console.error('[SCAN_API] Error creating new control:', insertError)
      return NextResponse.json({ 
        success: true, 
        message: 'Scan recorded, error updating control' 
      })
    }
    
    return NextResponse.json({
      success: true,
      message: `Scan recorded, station ${station_id} now controlled by team ${badgeData.team_id}`
    })
    
  } catch (error: any) {
    console.error('[SCAN_API] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 })
  }
}
