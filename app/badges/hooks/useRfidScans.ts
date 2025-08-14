'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, type RfidScan, type Badge } from '../../../lib/supabase'

export interface RfidScanWithStation extends RfidScan {
  stations?: {
    name: string
    location: string
  }
}

interface UseRfidScansProps {
  badges: Badge[]
  addBadgeToState: (badge: Badge) => void
  fetchBadges: () => Promise<Badge[] | undefined>
}

export function useRfidScans({ badges, addBadgeToState, fetchBadges }: UseRfidScansProps) {
  const [recentScans, setRecentScans] = useState<RfidScanWithStation[]>([])
  const [loadingScans, setLoadingScans] = useState(false)
  const [scanEventCount, setScanEventCount] = useState(0)
  const subscribedRef = useRef(false) // Track if we've subscribed
  
  console.log('[SCAN_DEBUG] useRfidScans hook initialized')

  const fetchRecentScans = async () => {
    const fetchId = Date.now()
    console.log(`[SCAN_DEBUG] [${fetchId}] Fetching recent scans...`)
    setLoadingScans(true)
    
    try {
      const { data, error } = await supabase
        .from('rfid_scans')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error(`[SCAN_DEBUG] [${fetchId}] Error fetching scans:`, error)
        throw error
      }
      
      console.log(`[SCAN_DEBUG] [${fetchId}] Received ${data?.length || 0} scans`)
      
      // Check for duplicates in scan data
      const uniqueScans = new Map<string, RfidScanWithStation>()
      data?.forEach(scan => {
        if (!uniqueScans.has(scan.id)) {
          uniqueScans.set(scan.id, scan as RfidScanWithStation)
        } else {
          console.log(`[SCAN_DEBUG] [${fetchId}] Duplicate scan found:`, scan.id)
        }
      })
      
      const finalScans = Array.from(uniqueScans.values())
      console.log(`[SCAN_DEBUG] [${fetchId}] Setting ${finalScans.length} unique scans to state`)
      setRecentScans(finalScans)
      
      // Auto-create badges for new UIDs
      await createBadgesForNewUIDs(finalScans)
      
      return finalScans
    } catch (error) {
      console.error(`[SCAN_DEBUG] [${fetchId}] Error in fetchRecentScans:`, error)
      return []
    } finally {
      setLoadingScans(false)
      console.log(`[SCAN_DEBUG] [${fetchId}] Fetch complete`)
    }
  }
  
  // Set up real-time subscription for RFID scans
  useEffect(() => {
    // Only set up subscription once and avoid recreating on badge changes
    if (subscribedRef.current) {
      console.log('[SCAN_DEBUG] Already subscribed to RFID scan events, skipping')
      return
    }
    
    console.log('[SCAN_DEBUG] Setting up real-time subscription for RFID scans')
    subscribedRef.current = true
    
    const subscription = supabase
      .channel('rfid_scans_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rfid_scans'
        },
        async (payload) => {
          const eventId = scanEventCount + 1
          setScanEventCount(prev => prev + 1)
          console.log(`[SCAN_DEBUG] [Event-${eventId}] Real-time RFID scan received:`, payload.new)
          const newScan = payload.new as RfidScanWithStation
          
          setRecentScans(prev => {
            // Check if scan is already in the list to avoid duplicates
            const exists = prev.some(scan => scan.id === newScan.id)
            if (exists) {
              console.log(`[SCAN_DEBUG] [Event-${eventId}] Scan already exists in state, skipping`)
              return prev
            }
            console.log(`[SCAN_DEBUG] [Event-${eventId}] Adding scan to recent scans state`)
            return [newScan, ...prev.slice(0, 19)]
          })
          
          // Auto-create badge if it doesn't exist
          await handleNewRfidScan(newScan, eventId)
        }
      )
      .subscribe((status) => {
        console.log('[SCAN_DEBUG] Subscription status:', status)
      })

    return () => {
      console.log('[SCAN_DEBUG] Unsubscribing from real-time channel')
      subscription.unsubscribe()
      subscribedRef.current = false
    }
  }, [])
  
  const handleNewRfidScan = async (scan: RfidScanWithStation, eventId: number) => {
    const uid = scan.uid
    console.log(`[SCAN_DEBUG] [Event-${eventId}] Processing badge for scan UID: ${uid}`)
    
    // First check if badge exists in current state
    const existsInState = badges.some(badge => badge.rfid_uid === uid)
    
    if (existsInState) {
      console.log(`[SCAN_DEBUG] [Event-${eventId}] Badge already exists in local state for UID: ${uid}`)
      return
    }
    
    try {
      // Check database for existing badge
      console.log(`[SCAN_DEBUG] [Event-${eventId}] Checking database for badge with UID: ${uid}`)
      const { data: existingBadge, error: queryError } = await supabase
        .from('badges')
        .select('*')
        .eq('rfid_uid', uid)
        .single()

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          // Not found, create new badge
          console.log(`[SCAN_DEBUG] [Event-${eventId}] Badge not found, creating new one`)
          const { data: newBadge, error: createError } = await supabase
            .from('badges')
            .insert([{ rfid_uid: uid, player_name: null, team_id: null }])
            .select()
            .single()

          if (createError) {
            console.error(`[SCAN_DEBUG] [Event-${eventId}] Error creating badge:`, createError)
            return
          }

          if (newBadge) {
            console.log(`[SCAN_DEBUG] [Event-${eventId}] Created new badge:`, newBadge)
            addBadgeToState(newBadge)
          }
        } else {
          console.error(`[SCAN_DEBUG] [Event-${eventId}] Error checking for existing badge:`, queryError)
        }
        return
      }

      if (existingBadge) {
        console.log(`[SCAN_DEBUG] [Event-${eventId}] Found existing badge:`, existingBadge)
        addBadgeToState(existingBadge)
      }
    } catch (error) {
      console.error(`[SCAN_DEBUG] [Event-${eventId}] Unexpected error handling scan:`, error)
    }
  }

  const createBadgesForNewUIDs = async (scans: RfidScan[]) => {
    console.log('[SCAN_DEBUG] Creating badges for new scan UIDs')
    const uniqueUIDs = Array.from(new Set(scans.map(scan => scan.uid)))
    const existingUIDs = badges.map(badge => badge.rfid_uid)
    const newUIDs = uniqueUIDs.filter(uid => !existingUIDs.includes(uid))
    
    console.log('[SCAN_DEBUG] Found', newUIDs.length, 'new UIDs to create badges for')

    for (const uid of newUIDs) {
      try {
        // Check if badge already exists in database (in case of race conditions)
        console.log('[SCAN_DEBUG] Checking if badge exists for UID:', uid)
        const { data: existingBadge } = await supabase
          .from('badges')
          .select('*')
          .eq('rfid_uid', uid)
          .single()

        if (existingBadge) {
          console.log('[SCAN_DEBUG] Badge already exists for UID:', uid)
          addBadgeToState(existingBadge)
          continue
        }

        // Create new badge
        console.log('[SCAN_DEBUG] Creating new badge for UID:', uid)
        const { data, error } = await supabase
          .from('badges')
          .insert([{ rfid_uid: uid, player_name: null, team_id: null }])
          .select()
          .single()

        if (error) {
          if (error.code === '23505') { // Duplicate key error
            console.log('[SCAN_DEBUG] Badge already exists (race condition) for UID:', uid)
            continue
          }
          throw error
        }

        console.log('[SCAN_DEBUG] Created new badge:', data)
        addBadgeToState(data)
      } catch (error) {
        console.error('[SCAN_DEBUG] Error creating badge for UID:', uid, error)
      }
    }
  }

  return {
    recentScans,
    loadingScans,
    fetchRecentScans,
    createBadgesForNewUIDs
  }
}
