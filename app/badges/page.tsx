'use client'

import { useState, useEffect } from 'react'
import { useBadges } from './hooks/useBadges'
import { useTeams } from './hooks/useTeams'
import { useRfidScans } from './hooks/useRfidScans'

import RecentScans from './components/RecentScans'
import UnassignedBadges from './components/UnassignedBadges'
import AssignedBadges from './components/AssignedBadges'

export default function BadgesPage() {
  const {
    badges,
    loading: badgesLoading,
    fetchingBadges,
    setLoading,
    fetchBadges,
    addBadgeToState,
    updateBadgePlayerName,
    assignBadgeToTeam
  } = useBadges()

  const {
    teams,
    loadingTeams,
    fetchTeams
  } = useTeams()

  const {
    recentScans,
    loadingScans,
    fetchRecentScans
  } = useRfidScans({ badges, addBadgeToState, fetchBadges })

  // Master loading state
  const [globalLoading, setGlobalLoading] = useState(true)

  // Debug counters
  const [renderCount, setRenderCount] = useState(0)
  const [refreshCount, setRefreshCount] = useState(0)
  
  // Log render information without causing infinite loops
  useEffect(() => {
    // Only log on initial render and when data actually changes
    console.log('[PAGE_DEBUG] BadgesPage rendered', renderCount, 'times')
    console.log('[PAGE_DEBUG] Current badge count:', badges.length)
    console.log('[PAGE_DEBUG] Current team count:', teams.length)
    console.log('[PAGE_DEBUG] Current scan count:', recentScans.length)
    
    // Increment render counter without causing loops
    if (renderCount === 0) {
      setRenderCount(1)
    }
  }, [badges.length, teams.length, recentScans.length])
  
  // Initialize all data on component mount
  useEffect(() => {
    const sessionId = Date.now()
    console.log(`[PAGE_DEBUG] [${sessionId}] BadgesPage mounted, initializing data...`)
    
    const initializeData = async () => {
      try {
        setGlobalLoading(true)
        console.log(`[PAGE_DEBUG] [${sessionId}] Fetching all data in parallel...`)
        
        // Clear any existing data first
        // Don't rely on the hooks to do this as there may be race conditions
        console.log(`[PAGE_DEBUG] [${sessionId}] Loading started`)
        
        // Fetch all data in parallel
        await Promise.all([
          fetchBadges(),
          fetchTeams(),
          fetchRecentScans()
        ])
        
        console.log(`[PAGE_DEBUG] [${sessionId}] All data fetched successfully`)
      } catch (error) {
        console.error(`[PAGE_DEBUG] [${sessionId}] Error initializing data:`, error)
      } finally {
        console.log(`[PAGE_DEBUG] [${sessionId}] Setting loading to false`)
        setGlobalLoading(false)
      }
    }
    
    initializeData()
    
    // Cleanup
    return () => {
      console.log('[PAGE_DEBUG] BadgesPage unmounting')
    }
  }, []) // Empty dependency array - only run on mount
  
  // Debug function to log entire state
  const debugState = () => {
    console.log('======= DEBUG STATE DUMP =======')
    console.log('Badges:', JSON.stringify(badges))
    console.log('Teams:', JSON.stringify(teams))
    console.log('Recent Scans:', JSON.stringify(recentScans))
    console.log('======= END DEBUG STATE DUMP =======')
  }
  
  // Refresh all data
  const handleRefresh = async () => {
    const refreshId = Date.now()
    setRefreshCount(prev => prev + 1)
    
    console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] Manual refresh triggered (${refreshCount + 1})`)
    setGlobalLoading(true)
    
    try {
      // Important: clear all data first to prevent duplicates
      console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] Clearing all data...`)
      // We're intentionally NOT using the setBadges, setTeams, etc. directly
      // Let the hooks handle their own state to avoid race conditions
      
      // Fetch all data in sequence to avoid race conditions
      console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] Fetching badges...`)
      await fetchBadges()
      
      console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] Fetching teams...`)
      await fetchTeams()
      
      console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] Fetching recent scans...`)
      await fetchRecentScans()
      
      console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] All data refreshed`)
      
      // Debug state after refresh
      console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] Final badge count:`, badges.length)
      console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] Final badge UIDs:`, badges.map(b => b.rfid_uid))
    } catch (error) {
      console.error(`[PAGE_DEBUG] [Refresh-${refreshId}] Error during refresh:`, error)
    } finally {
      console.log(`[PAGE_DEBUG] [Refresh-${refreshId}] Setting loading to false`)
      setGlobalLoading(false)
    }
  }
  
  // Emergency fix for duplication issue - dump current state and fetch fresh
  const handleEmergencyRefresh = async () => {
    console.log('[PAGE_DEBUG] EMERGENCY REFRESH - Complete state reset and reload')
    
    // Force a complete state refresh
    setGlobalLoading(true)
    
    try {
      // Reload the page - this is a last resort but will definitely clear all state
      window.location.reload()
    } catch (error) {
      console.error('[PAGE_DEBUG] Error during emergency refresh:', error)
      setGlobalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black bg-opacity-90 p-6 relative text-cyan-400">
      {/* Background pattern overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-circuit-pattern opacity-5"></div>
      <div className="fixed inset-0 pointer-events-none z-0 bg-grid-pattern opacity-10"></div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="bg-blue-900/20 backdrop-blur-sm border border-cyan-800/50 rounded-lg p-6 mb-6 shadow-lg shadow-cyan-900/20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-cyan-300 font-mono uppercase tracking-wider">Personnel Tags</h1>
              <div className="text-xs text-cyan-500 font-mono">COMBATANT IDENTIFICATION SYSTEM</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={debugState}
                className="cyber-button-small bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-cyan-300 hover:border-cyan-700"
              >
                Debug_SYS
              </button>
              <button
                onClick={handleRefresh}
                disabled={globalLoading || fetchingBadges}
                className={`cyber-button-small ${globalLoading || fetchingBadges ? 'opacity-50' : 'glow-cyan'}`}
              >
                {globalLoading || fetchingBadges ? 'SYNCING...' : 'SYNC_DATA'}
              </button>
              <button
                onClick={handleEmergencyRefresh}
                className="cyber-button-small bg-red-900/30 border border-red-700/50 text-red-400 hover:text-red-300 hover:border-red-500/70"
              >
                RESET_SYS
              </button>
            </div>
          </div>

          {/* Recent RFID Scans */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-cyan-800 to-transparent"></div>
              <h2 className="text-lg font-bold mx-4 text-cyan-300 font-mono uppercase tracking-wider">Recent Signals</h2>
              <div className="h-px flex-grow bg-gradient-to-r from-cyan-800 via-transparent to-transparent"></div>
              <div className="ml-2 text-xs bg-cyan-900/50 text-cyan-400 px-2 py-1 rounded border border-cyan-800/50 font-mono">
                {recentScans.length}
              </div>
            </div>
            <RecentScans
              recentScans={recentScans}
              loading={globalLoading || loadingScans}
            />
          </div>

          {/* Unassigned Badges */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-cyan-800 to-transparent"></div>
              <h2 className="text-lg font-bold mx-4 text-cyan-300 font-mono uppercase tracking-wider">Unassigned Tags</h2>
              <div className="h-px flex-grow bg-gradient-to-r from-cyan-800 via-transparent to-transparent"></div>
              <div className="ml-2 text-xs bg-cyan-900/50 text-cyan-400 px-2 py-1 rounded border border-cyan-800/50 font-mono">
                {badges.filter(badge => !badge.team_id).length}
              </div>
            </div>
            <UnassignedBadges
              badges={badges}
              teams={teams}
              loading={globalLoading || badgesLoading}
              onUpdatePlayerName={updateBadgePlayerName}
              onAssignTeam={assignBadgeToTeam}
            />
          </div>

          {/* Assigned Badges by Team */}
          <div>
            <div className="flex items-center mb-4">
              <div className="h-px flex-grow bg-gradient-to-r from-transparent via-cyan-800 to-transparent"></div>
              <h2 className="text-lg font-bold mx-4 text-cyan-300 font-mono uppercase tracking-wider">Assigned Tags</h2>
              <div className="h-px flex-grow bg-gradient-to-r from-cyan-800 via-transparent to-transparent"></div>
              <div className="ml-2 text-xs bg-cyan-900/50 text-cyan-400 px-2 py-1 rounded border border-cyan-800/50 font-mono">
                {badges.filter(badge => badge.team_id).length}
              </div>
            </div>
            <AssignedBadges
              badges={badges}
              teams={teams}
              loading={globalLoading || badgesLoading}
              onUpdatePlayerName={updateBadgePlayerName}
              onAssignTeam={assignBadgeToTeam}
            />
          </div>
        </div>
      </div>
      
      {/* Debug info footer */}
      <div className="text-xs text-gray-400 text-center mt-2">
        Render Count: {renderCount} | Badge Count: {badges.length} | Page ID: {Date.now()}
      </div>
    </div>
  )
}
