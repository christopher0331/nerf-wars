import { useState, useEffect } from 'react'
import { supabase, type Team, type Station, type GameSession } from '../../../lib/supabase'
import { playStationCaptured } from '../../../lib/soundEffects'

export interface StationWithControl {
  station: Station
  controllingTeam: Team | null
  controlStartTime: string | null
}

export function useStationControl(
  activeSession: GameSession | null,
  activeStations: Station[],
  teams: Team[]
) {
  const [gameStations, setGameStations] = useState<StationWithControl[]>([])
  const [updateCounter, setUpdateCounter] = useState<number>(0)

  // Function to force UI updates
  const forceUIUpdate = () => {
    console.log('🔄 Forcing UI update')
    setUpdateCounter(prevCount => prevCount + 1)
  }

  // Initialize station controls on load
  useEffect(() => {
    if (!activeSession || !activeStations.length || !teams.length) return

    const loadInitialControls = async () => {
      try {
        // Get current station control status
        const { data: controlData, error: controlError } = await supabase
          .from('station_control')
          .select('*')
          .eq('game_session_id', activeSession.id)
          .eq('is_current_control', true)
        
        if (controlError) throw controlError
        
        console.log('Active stations for this game (filtered):', activeStations)
        console.log('Station control data:', controlData)

        // Map stations to their control state
        const stationControls = activeStations.map(station => {
          // Find if this station is currently controlled - check both id and uuid
          const control = controlData?.find(c => 
            c.station_id === station.uuid || c.station_id === station.id
          )
          
          if (control) {
            console.log('Found initial control for station:', {
              stationName: station.name,
              stationId: station.id,
              stationUuid: station.uuid,
              controlStationId: control.station_id,
              teamId: control.team_id
            })
          }
          
          // If controlled, find the controlling team
          const controllingTeam = control 
            ? teams?.find(t => t.id === control.team_id) || null 
            : null

          if (controllingTeam) {
            console.log(`Station ${station.name} is controlled by team ${controllingTeam.name}`)
          }
          
          return {
            station,
            controllingTeam,
            controlStartTime: control?.controlled_at || null
          }
        })
        
        console.log('Final station controls:', stationControls.map(s => ({
          name: s.station.name, 
          controlled: !!s.controllingTeam,
          team: s.controllingTeam?.name
        })))
        
        setGameStations(stationControls)
      } catch (error) {
        console.error('Error loading initial station controls:', error)
      }
    }

    loadInitialControls()
  }, [activeSession, activeStations, teams])

  // Set up real-time subscription for station control changes
  useEffect(() => {
    // Set up real-time listeners for station control
    const stationControlSubscription = supabase
      .channel('station-control-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'station_control',
      }, handleStationControlChange)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'station_control',
      }, handleStationControlChange)
      .subscribe()
      
    // Force re-render of game stations on an interval (increased frequency for more responsive UI)
    const controlTimeInterval = setInterval(() => {
      // Force re-render of game stations
      setGameStations(prevStations => {
        // Create a deep copy to ensure React detects the change
        return JSON.parse(JSON.stringify(prevStations))
      })
      // Also increment update counter to force child component re-renders
      setUpdateCounter(prev => prev + 1)
    }, 500) // Update twice per second for more responsive UI
      
    return () => {
      clearInterval(controlTimeInterval)
      stationControlSubscription.unsubscribe()
    }
  }, []) // Only run on mount

  // Handle real-time updates to station control
  const handleStationControlChange = async (payload: any) => {
    console.log('🔄 Station control changed (REAL-TIME):', payload)
    
    // Continue even if session isn't loaded yet, data will be fetched
    if (!payload.new) {
      console.error('Invalid payload received')
      return
    }
    
    try {
      // Get complete data for this change
      const newControl = payload.new
      const incomingStationId = newControl.station_id // FIXED: Renamed from stationId to avoid confusion
      const teamId = newControl.team_id
      const gameSessionId = newControl.game_session_id
      
      console.log('🔄 Control change details:', {
        stationId: incomingStationId,
        teamId,
        gameSessionId,
        activeSessionId: activeSession?.id
      })
      
      // If we have an active session but it doesn't match this update, ignore it
      if (activeSession && activeSession.id !== gameSessionId) {
        console.log('Ignoring update for different game session')
        return
      }
      
      // Fetch the team data
      let teamData = null
      if (teamId) {
        const { data: fetchedTeam, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', teamId)
          .single()
        
        if (teamError) {
          console.error('Error fetching team data:', teamError)
        } else {
          teamData = fetchedTeam
          console.log('🔍 Fetched team data:', {
            id: teamData?.id,
            name: teamData?.name,
            color: teamData?.color,
            fullTeamData: teamData
          })
        }
      }

      // Update the gameStations state directly
      setGameStations(prevGameStations => {
        // Deep copy to ensure React sees the change
        const updatedStations = JSON.parse(JSON.stringify(prevGameStations))
        
        // Log current state for debugging
        console.log('Looking for station with id/uuid matching:', incomingStationId)
        console.log('Current stations:', updatedStations.map((s: any) => ({ 
          name: s.station.name,
          id: s.station.id, 
          uuid: s.station.uuid 
        })))
        
        // Find the station index - check all possible ID fields with more detailed logging
        console.log('Looking for station that matches:', incomingStationId)
        console.log('Available stations:', updatedStations.map((s: any) => ({
          name: s.station.name,
          id: s.station.id,
          uuid: s.station.uuid
        })))
        
        // Handle firmware's hardcoded station IDs (from memory)
        const hardcodedIDs = {
          'Station 1': '04bc0dd5-a929-40f7-85d4-db99555b21db',
          'Station 3': 'e8a06b61-7a9e-4252-8606-cd6ebcc9f396'
        }
        
        // Map from hardcoded IDs back to station names for verification
        const stationNameFromHardcodedId = {
          '04bc0dd5-a929-40f7-85d4-db99555b21db': 'Station 1',
          'e8a06b61-7a9e-4252-8606-cd6ebcc9f396': 'Station 3'
        }
        
        // Get the expected station name if this is a hardcoded ID
        const expectedStationName = stationNameFromHardcodedId[incomingStationId] || null
        console.log('Expected station name from ID:', expectedStationName)
        
        // EXACT MATCH ONLY - Don't use fuzzy matching or name-based matching here
        // This ensures only the exact station gets updated
        
        // Debug log to track which match criteria is being used
        updatedStations.forEach((station: any, index: number) => {
          // FIXED: Changed stationId property name to stationDbId to avoid confusion
          console.log(`Checking station ${station.station.name}:`, {
            incomingStationId,
            stationDbId: station.station.id,
            stationUuid: station.station.uuid,
            hardcodedId: hardcodedIDs[station.station.name],
            isDirectMatch: station.station.id === incomingStationId || station.station.uuid === incomingStationId,
            isHardcodedMatch: hardcodedIDs[station.station.name] === incomingStationId
          });
        });
        
        const stationIndex = updatedStations.findIndex((station: any) => {
          // CRITICAL: We need to be VERY specific about which station to update
          // First, check direct database ID matches
          if (station.station.id === incomingStationId) {
            console.log(`Found direct DB ID match for ${station.station.name}`);
            return true;
          }
          
          // Then check UUID matches
          if (station.station.uuid === incomingStationId) {
            console.log(`Found UUID match for ${station.station.name}`);
            return true;
          }
          
          // Finally check hardcoded ID match by name - but be VERY specific
          const stationName = station.station.name;
          
          // If we know which station name should match this ID, only allow that specific station
          if (expectedStationName) {
            // STRICT: Only match if station name exactly matches expected name from hardcoded ID mapping
            if (stationName === expectedStationName && hardcodedIDs[stationName] === incomingStationId) {
              console.log(`Found strict hardcoded ID match for ${stationName}`);
              return true;
            }
          } else if (hardcodedIDs[stationName] && hardcodedIDs[stationName] === incomingStationId) {
            // Fallback if we don't have an expected name (shouldn't happen)
            console.log(`Found hardcoded ID match for ${stationName}`);
            return true;
          }
          
          return false;
        })
        
        if (stationIndex >= 0) {
          // Update this station's control with the new team
          updatedStations[stationIndex] = {
            ...updatedStations[stationIndex],
            controllingTeam: teamData,
            controlStartTime: newControl.controlled_at
          }
          
          console.log('🎮 UPDATED STATION CONTROL IN UI:', {
            stationName: updatedStations[stationIndex].station.name,
            controllingTeam: teamData?.name || 'None',
            teamColor: teamData?.color || 'gray'
          })
          
          // Play station capture announcement
          if (teamData) {
            const stationName = updatedStations[stationIndex].station.name
            const teamName = teamData.name
            console.log(`🔊 About to play announcement:`, {
              stationName,
              teamName,
              teamId: teamData.id,
              fullTeamData: teamData
            })
            console.log(`🔊 Playing capture announcement: ${stationName} captured by ${teamName}`)
            playStationCaptured(stationName, teamName).catch(error => {
              console.error('Error playing station capture sound:', error)
            })
          } else {
            console.error('❌ No team data available for announcement')
          }
        } else {
          console.error('Could not find station with id:', incomingStationId)
        }
        
        // Force update counter to increment to ensure UI refreshes
        setUpdateCounter(prev => prev + 1)
        
        // Log successful update for debugging
        console.log('🔄 Station control updated, forcing UI refresh')
        
        return updatedStations
      })
    } catch (error) {
      console.error('Error handling station control change:', error)
    }
  }

  // Handle RFID scans (simplified from original)
  const handleRfidScan = (payload: any) => {
    console.log('📊 RFID scan received:', payload)
    // We don't need to do anything specific here anymore
    // as the station control updates will come through the other subscription
  }

  return {
    gameStations,
    updateCounter,
    setGameStations
  }
}
