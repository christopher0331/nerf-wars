import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Team, type Station, type GameSession, type Game } from '../../../lib/supabase'

export function useGameData() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [activeGame, setActiveGame] = useState<Game | null>(null)
  const [activeSession, setActiveSession] = useState<GameSession | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [activeStations, setActiveStations] = useState<Station[]>([])

  // Timer related state
  const [gameTimeRemaining, setGameTimeRemaining] = useState<number>(0)
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null)
  const [gameEndTime, setGameEndTime] = useState<Date | null>(null)

  useEffect(() => {
    fetchGameData()
  }, [])

  // Set up game timer when active session is loaded
  useEffect(() => {
    if (!activeSession || !activeGame) return
    
    const startTime = activeSession.start_time ? new Date(activeSession.start_time) : null
    if (!startTime) return
    
    setGameStartTime(startTime)
    
    // Calculate end time based on duration
    const endTime = new Date(startTime.getTime() + activeGame.duration_minutes * 60 * 1000)
    setGameEndTime(endTime)
    
    // Initial update
    updateGameTimeRemaining()
    
  }, [activeSession, activeGame])

  // Update remaining time
  const updateGameTimeRemaining = () => {
    if (!gameEndTime) return

    const now = new Date()
    const remaining = Math.max(0, gameEndTime.getTime() - now.getTime())
    setGameTimeRemaining(remaining)
    return remaining
  }

  const fetchGameData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Get active game session
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('status', 'active')
        .single()
      
      if (sessionError) {
        if (sessionError.code === 'PGRST116') {
          // No active session found
          setError('No active game session found')
          setLoading(false)
          return
        }
        throw sessionError
      }
      
      setActiveSession(sessionData)
      
      // Get game details
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', sessionData.game_id)
        .single()
      
      if (gameError) throw gameError
      setActiveGame(gameData)
      
      // Only proceed for King of the Hill
      if (gameData.type !== 'king_of_the_hill') {
        router.push('/games')
        return
      }
      
      // Get teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true })
      
      if (teamsError) throw teamsError
      setTeams(teamsData || [])
      
      // Get all stations
      const { data: stationsData, error: stationsError } = await supabase
        .from('stations')
        .select('*')
        .eq('is_active', true)
      
      if (stationsError) throw stationsError
      setStations(stationsData || [])
      
      // Get active stations for this game from game_stations table
      const { data: gameStationsData, error: gameStationsError } = await supabase
        .from('game_stations')
        .select('station_id')
        .eq('game_session_id', sessionData.id)
      
      if (gameStationsError) throw gameStationsError
      
      // Filter stations to only show those selected for this game
      const activeStationIds = gameStationsData.map(gs => gs.station_id);
      const filteredStations = stationsData?.filter(station => 
        activeStationIds.includes(station.id) || activeStationIds.includes(station.uuid)
      ) || [];
      
      console.log('Active stations for this game:', filteredStations);
      // Store filtered stations that are active in this game
      setActiveStations(filteredStations)
      
    } catch (error: any) {
      console.error('Error fetching game data:', error)
      setError('Failed to load game data')
    } finally {
      setLoading(false)
    }
  }

  const stopGame = async () => {
    if (!activeSession) return
    
    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({ status: 'completed', end_time: new Date().toISOString() })
        .eq('id', activeSession.id)
      
      if (error) throw error
      
      // Redirect to games page after stopping
      router.push('/games')
      
    } catch (error: any) {
      console.error('Error stopping game:', error)
      setError('Failed to stop game')
    }
  }

  return {
    loading,
    error,
    activeGame,
    activeSession,
    teams,
    stations,
    activeStations,
    gameTimeRemaining,
    gameStartTime,
    gameEndTime,
    updateGameTimeRemaining,
    stopGame,
    fetchGameData
  }
}
