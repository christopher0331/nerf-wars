'use client'

import { useState } from 'react'
import { supabase, type Team } from '../../../lib/supabase'

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  
  console.log('[TEAM_DEBUG] useTeams hook initialized')

  const fetchTeams = async () => {
    console.log('[TEAM_DEBUG] Fetching teams from database...')
    setLoadingTeams(true)
    
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('[TEAM_DEBUG] Error fetching teams:', error)
        throw error
      }
      
      console.log('[TEAM_DEBUG] Received teams:', data?.length || 0)
      setTeams(data || [])
      return data
    } catch (error) {
      console.error('[TEAM_DEBUG] Error in fetchTeams:', error)
      return []
    } finally {
      setLoadingTeams(false)
    }
  }

  return {
    teams,
    loadingTeams,
    fetchTeams
  }
}
