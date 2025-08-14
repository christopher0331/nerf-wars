'use client'

import { useState, useEffect } from 'react'
import { supabase, type Badge } from '../../../lib/supabase'

export function useBadges() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingBadges, setFetchingBadges] = useState(false)
  const [fetchCount, setFetchCount] = useState(0) // Debug counter
  
  console.log('[BADGE_DEBUG] useBadges hook initialized')
  
  const fetchBadges = async () => {
    // If already fetching, don't start another fetch
    if (fetchingBadges) {
      console.log('[BADGE_DEBUG] Already fetching badges, skipping duplicate request')
      return
    }
    
    const fetchId = Date.now() // Generate unique ID for this fetch operation
    console.log(`[BADGE_DEBUG] [${fetchId}] Starting badges fetch, fetch count: ${fetchCount + 1}`)
    setFetchCount(prev => prev + 1)
    
    try {
      setFetchingBadges(true)
      
      // First clear the current badges to prevent duplication
      console.log(`[BADGE_DEBUG] [${fetchId}] Clearing badge state before fetch`)
      setBadges([])
      
      // Now fetch from database
      console.log(`[BADGE_DEBUG] [${fetchId}] Requesting data from Supabase`)
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(`[BADGE_DEBUG] [${fetchId}] Supabase error:`, error)
        throw error
      }
      
      console.log(`[BADGE_DEBUG] [${fetchId}] Received ${data?.length || 0} badges from Supabase`)
      
      // Group badges by rfid_uid and take only the first occurrence
      const uniqueMap = new Map<string, Badge>()
      if (data) {
        data.forEach(badge => {
          if (!uniqueMap.has(badge.rfid_uid)) {
            uniqueMap.set(badge.rfid_uid, badge)
          } else {
            console.log(`[BADGE_DEBUG] [${fetchId}] Skipping duplicate badge rfid_uid: ${badge.rfid_uid}`)
          }
        })
      }
      
      const uniqueBadges = Array.from(uniqueMap.values())
      console.log(`[BADGE_DEBUG] [${fetchId}] Setting badges state with ${uniqueBadges.length} unique badges`)
      
      // Log all badge UIDs for debugging
      console.log(`[BADGE_DEBUG] [${fetchId}] Badge UIDs in final state:`, uniqueBadges.map(b => b.rfid_uid))
      
      setBadges(uniqueBadges)
      
      return uniqueBadges // Return for use elsewhere
    } catch (error) {
      console.error(`[BADGE_DEBUG] [${fetchId}] Error fetching badges:`, error)
      return []
    } finally {
      console.log(`[BADGE_DEBUG] [${fetchId}] Fetch operation complete`)
      setFetchingBadges(false)
    }
  }

  // This method adds a single badge to state if it doesn't exist
  const addBadgeToState = (newBadge: Badge) => {
    console.log('[BADGE_DEBUG] Attempting to add badge to state:', newBadge.rfid_uid)
    
    setBadges(prev => {
      // Check if already exists
      const exists = prev.some(b => b.rfid_uid === newBadge.rfid_uid)
      
      if (exists) {
        console.log('[BADGE_DEBUG] Badge already exists in state, skipping:', newBadge.rfid_uid)
        return prev
      }
      
      console.log('[BADGE_DEBUG] Adding new badge to state:', newBadge.rfid_uid)
      console.log('[BADGE_DEBUG] Current badge count:', prev.length, 'New count will be:', prev.length + 1)
      return [newBadge, ...prev]
    })
  }
  
  // Updates player name for a badge
  const updateBadgePlayerName = async (badgeId: string, playerName: string) => {
    console.log('[BADGE_DEBUG] Updating player name for badge:', badgeId, 'to:', playerName)
    
    try {
      // Update local state immediately for responsive UI
      setBadges(prev => prev.map(badge => 
        badge.id === badgeId 
          ? { ...badge, player_name: playerName }
          : badge
      ))

      // Update database
      const { error } = await supabase
        .from('badges')
        .update({ player_name: playerName })
        .eq('id', badgeId)

      if (error) throw error
      console.log('[BADGE_DEBUG] Player name update successful for badge:', badgeId)
    } catch (error) {
      console.error('[BADGE_DEBUG] Error updating badge player name:', error)
      // Revert local state on error by refetching
      fetchBadges()
    }
  }

  // Assigns badge to team
  const assignBadgeToTeam = async (badgeId: string, teamId: string | null) => {
    console.log('[BADGE_DEBUG] Assigning badge', badgeId, 'to team:', teamId)
    
    try {
      const { error } = await supabase
        .from('badges')
        .update({ team_id: teamId })
        .eq('id', badgeId)

      if (error) throw error
      
      setBadges(prev => prev.map(badge => 
        badge.id === badgeId ? { ...badge, team_id: teamId } : badge
      ))
      
      console.log('[BADGE_DEBUG] Badge assignment successful')
    } catch (error) {
      console.error('[BADGE_DEBUG] Error assigning badge to team:', error)
      // Refresh to ensure consistency
      fetchBadges()
    }
  }

  return {
    badges,
    loading,
    fetchingBadges,
    setLoading,
    fetchBadges,
    addBadgeToState,
    updateBadgePlayerName,
    assignBadgeToTeam
  }
}
