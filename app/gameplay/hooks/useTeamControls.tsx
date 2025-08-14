import { useState, useEffect } from 'react'
import { supabase, type Team, type GameSession, type Game } from '../../../lib/supabase'
import { StationWithControl } from './useStationControl'

export interface TeamWithControl {
  team: Team
  controlTime: number
  controlPercentage: number
  activeStationCount: number
}

export function useTeamControls(
  teams: Team[],
  activeSession: GameSession | null,
  activeGame: Game | null,
  gameStations: StationWithControl[],
  stopGame: () => Promise<void>
) {
  const [teamControls, setTeamControls] = useState<TeamWithControl[]>([])
  const [winningTeam, setWinningTeam] = useState<Team | null>(null)
  const [showVictoryModal, setShowVictoryModal] = useState(false)

  // Update team control percentages whenever any relevant data changes
  useEffect(() => {
    if (!teams.length || !activeGame || !activeSession) return
    
    updateTeamControls()
    
    // Set up interval to refresh team controls every second
    const intervalId = setInterval(updateTeamControls, 1000)
    
    return () => clearInterval(intervalId)
  }, [teams, gameStations, activeSession, activeGame])

  const updateTeamControls = async () => {
    if (!teams.length || !activeGame || !activeSession) return
    
    // The duration_minutes now represents the control time needed to win (not game length)
    const controlTimeToWinSeconds = activeGame.duration_minutes * 60
    
    try {
      // Get total control time for each team
      const teamControlsPromises = teams.map(async (team) => {
        // Calculate from database for historical data
        const { data: controlData, error: controlError } = await supabase
          .from('station_control')
          .select('control_duration_seconds, controlled_at, is_current_control, station_id')
          .eq('game_session_id', activeSession.id)
          .eq('team_id', team.id)
        
        if (controlError) throw controlError
        
        // Sum up control durations from completed controls
        const historicalControlTime = controlData
          ?.filter(control => !control.is_current_control)
          .reduce((sum, control) => sum + (control.control_duration_seconds || 0), 0) || 0
        
        // Add current ongoing controls
        let currentControlTime = 0
        
        // For each active control, calculate ongoing time
        const activeControls = controlData?.filter(control => control.is_current_control) || []
        activeControls.forEach(control => {
          if (control.controlled_at) {
            const startTime = new Date(control.controlled_at)
            const now = new Date()
            const durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)
            currentControlTime += durationSeconds
          }
        })
        
        // Log for debugging
        console.log(`Team ${team.name} - Historical: ${historicalControlTime}s, Current: ${currentControlTime}s`)
        
        const totalControlTime = historicalControlTime + currentControlTime
        const controlPercentage = Math.min(100, (totalControlTime / controlTimeToWinSeconds) * 100)
        
        // Check if this team has won by reaching the required control time
        if (totalControlTime >= controlTimeToWinSeconds && !winningTeam) {
          console.log(`🏆 Team ${team.name} has won by reaching the required control time!`)
          setWinningTeam(team)
          setShowVictoryModal(true)
          // Don't automatically stop the game - let the modal handle that
        }
        
        return {
          team,
          controlTime: totalControlTime,
          controlPercentage,
          activeStationCount: activeControls.length
        }
      })
      
      const newTeamControls = await Promise.all(teamControlsPromises)
      
      // Sort teams by control time (descending)
      newTeamControls.sort((a, b) => b.controlTime - a.controlTime)
      setTeamControls(newTeamControls)
      
    } catch (error) {
      console.error('Error updating team controls:', error)
    }
  }

  const closeVictoryModal = () => {
    setShowVictoryModal(false)
  }

  return {
    teamControls,
    updateTeamControls,
    winningTeam,
    showVictoryModal,
    setShowVictoryModal,
    closeVictoryModal
  }
}
