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

    console.log(`RFID Scan received: Badge ${rfid_uid} at Station ${station_id}`)

    // Get active game session (if any)
    const { data: sessionData } = await supabase
      .from('game_sessions')
      .select('id, game_id')
      .eq('status', 'active')
      .maybeSingle()

    // Create the scan record
    const scanRecord = {
      uid: rfid_uid,
      station_id: station_id,
      // Only include game_session_id if there's an active session
      ...(sessionData && { game_session_id: sessionData.id, game_id: sessionData.game_id })
    }

    // Record the scan in the database
    const { data, error } = await supabase
      .from('rfid_scans')
      .insert(scanRecord)
      .select()
      .single()

    if (error) {
      console.error('Error recording scan:', error)
      return NextResponse.json({ error: 'Failed to record scan' }, { status: 500 })
    }

    // Check if badge exists in database, if not create it
    const { data: badgeData, error: badgeError } = await supabase
      .from('badges')
      .select('id')
      .eq('rfid_uid', rfid_uid)
      .single()

    if (badgeError) {
      if (badgeError.code === 'PGRST116') { // No rows returned (badge doesn't exist)
        console.log(`Badge ${rfid_uid} not found, creating new badge record`)
        const { error: createError } = await supabase
          .from('badges')
          .insert({
            rfid_uid: rfid_uid,
            label: `Badge ${rfid_uid.substring(0, 6)}`
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating badge:', createError)
          // We'll continue even if badge creation fails, as the scan was recorded
        }
      } else {
        console.error('Error checking for badge:', badgeError)
        // Continue even with error, as the scan was recorded
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Scan recorded successfully',
      scan: data
    })
  } catch (error: any) {
    console.error('Error processing RFID scan:', error)
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 500 })
  }
}
