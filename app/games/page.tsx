'use client'

import { useState, useEffect } from 'react'
import { supabase, type GameSession, type Team } from '../../lib/supabase'
import { PlayIcon, StopIcon, ClockIcon } from '@heroicons/react/24/outline'

const GAME_TYPES = [
  { 
    value: 'king_of_the_hill', 
    label: 'King of the Hill', 
    description: 'Control stations for the longest time to win',
    icon: '👑'
  },
  { 
    value: 'sequence', 
    label: 'Sequence', 
    description: 'Capture stations in the correct order',
    icon: '🎯'
  },
]

const DURATION_OPTIONS = [5, 10, 15, 20, 30]

export default function GamesPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [activeSession, setActiveSession] = useState<GameSession | null>(null)
  const [selectedGameType, setSelectedGameType] = useState('king_of_the_hill')
  const [selectedDuration, setSelectedDuration] = useState(10)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeams()
    fetchActiveSession()
  }, [])

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error fetching teams:', error)
    }
  }

  const fetchActiveSession = async () => {
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('status', 'active')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setActiveSession(data)
    } catch (error) {
      console.error('Error fetching active session:', error)
    } finally {
      setLoading(false)
    }
  }

  const [stations, setStations] = useState([])  
  const [selectedStations, setSelectedStations] = useState([])

  useEffect(() => {
    fetchStations()
  }, [])

  const fetchStations = async () => {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setStations(data || [])
    } catch (error) {
      console.error('Error fetching stations:', error)
    }
  }

  const toggleStationSelection = (stationId) => {
    if (selectedStations.includes(stationId)) {
      setSelectedStations(selectedStations.filter(id => id !== stationId))
    } else {
      setSelectedStations([...selectedStations, stationId])
    }
  }
  
  const startGame = async () => {
    if (teams.length < 2) {
      alert('You need at least 2 teams to start a game!')
      return
    }
    
    if (selectedGameType === 'king_of_the_hill' && selectedStations.length === 0) {
      alert('You must select at least one station for King of the Hill!')
      return
    }

    try {
      // First create a game record
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert([
          {
            name: `${GAME_TYPES.find(t => t.value === selectedGameType)?.label} Game`,
            type: selectedGameType,
            duration_minutes: selectedDuration,
            status: 'active'
          }
        ])
        .select()
        .single()

      if (gameError) throw gameError

      // Then create a game session
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .insert([
          {
            game_id: gameData.id,
            start_time: new Date().toISOString(),
            status: 'active'
          }
        ])
        .select()
        .single()

      if (sessionError) throw sessionError

      // If this is King of the Hill, store selected stations for this game
      if (selectedGameType === 'king_of_the_hill' && selectedStations.length > 0) {
        // Store selected stations in game_stations table
        const gameStationsData = selectedStations.map(stationId => ({
          game_id: gameData.id,
          station_id: stationId,
          game_session_id: sessionData.id
        }))

        const { error: stationsError } = await supabase
          .from('game_stations')
          .insert(gameStationsData)

        if (stationsError) throw stationsError
      }

      setActiveSession(sessionData)
      
      // Redirect to the gameplay page
      window.location.href = '/gameplay'
    } catch (error) {
      console.error('Error starting game:', error)
      alert('Failed to start game')
    }
  }

  const stopGame = async () => {
    if (!activeSession) return

    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', activeSession.id)

      if (error) throw error
      setActiveSession(null)
      alert('Game stopped!')
    } catch (error) {
      console.error('Error stopping game:', error)
      alert('Failed to stop game')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-circuit-pattern">
        <div className="text-lg text-cyan-500 animate-pulse">INITIALIZING GAME SYSTEMS...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-circuit-pattern">
      <div className="max-w-4xl mx-auto">
        <div className="bg-black/80 border-2 border-cyan-700 rounded-lg shadow-lg shadow-cyan-500/20 p-6 mb-6">
          <h1 className="text-2xl font-bold text-cyan-400 mb-6">GAME CONTROL</h1>

          {/* Active Game Status */}
          {activeSession && (
            <div className="bg-green-900/30 border-2 border-green-500/70 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-green-400">
                    ACTIVE GAME SESSION
                  </h2>
                  <p className="text-green-400">
                    STATUS: {activeSession.status.toUpperCase()}
                  </p>
                  <p className="text-green-400/80 text-sm">
                    STARTED: {activeSession.start_time ? new Date(activeSession.start_time).toLocaleTimeString() : 'NOT STARTED'}
                  </p>
                </div>
                <button
                  onClick={stopGame}
                  className="cyber-button-red flex items-center gap-2"
                >
                  <StopIcon className="h-5 w-5" />
                  TERMINATE
                </button>
              </div>
            </div>
          )}

          {/* Game Selection */}
          {!activeSession && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-cyan-400 mb-4">SELECT GAME TYPE</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {GAME_TYPES.map((gameType) => (
                    <div
                      key={gameType.value}
                      onClick={() => setSelectedGameType(gameType.value)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-colors cyberpunk-card ${
                        selectedGameType === gameType.value
                          ? 'border-yellow-500 bg-black/70 shadow-lg shadow-yellow-500/30'
                          : 'border-cyan-700 bg-black/70 hover:border-cyan-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{gameType.icon}</span>
                        <div>
                          <h3 className="font-semibold text-cyan-300">{gameType.label}</h3>
                          <p className="text-sm text-cyan-500">{gameType.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-cyan-400 mb-4">GAME DURATION</h2>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map((duration) => (
                    <button
                      key={duration}
                      onClick={() => setSelectedDuration(duration)}
                      className={`cyber-button px-4 py-2 rounded-md transition-colors ${
                        selectedDuration === duration
                          ? 'bg-yellow-900/50 text-yellow-400 border-yellow-500 shadow-md shadow-yellow-500/30'
                          : 'bg-black/70 text-cyan-400 border-cyan-700 hover:border-cyan-500'
                      }`}
                    >
                      <ClockIcon className="h-4 w-4 inline mr-1" />
                      {duration}m
                    </button>
                  ))}
                </div>
              </div>
              
              {selectedGameType === 'king_of_the_hill' && (
                <div>
                  <h2 className="text-lg font-semibold text-cyan-400 mb-4">SELECT CONTROL POINTS</h2>
                  {stations.length === 0 ? (
                    <p className="text-cyan-500">No stations available.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {stations.map(station => (
                        <div
                          key={station.id}
                          onClick={() => toggleStationSelection(station.id)}
                          className={`cyber-card p-4 rounded-lg cursor-pointer transition-colors ${
                            selectedStations.includes(station.id)
                              ? 'border-green-500 bg-green-900/30 shadow-lg shadow-green-500/20'
                              : 'border-cyan-700 bg-black/70 hover:border-cyan-500'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-cyan-300">{station.name}</h3>
                              <p className="text-sm text-cyan-500">{station.location || 'No location'}</p>
                            </div>
                            {selectedStations.includes(station.id) && (
                              <div className="text-green-400 text-xl">✓</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-sm text-cyan-500">
                    {selectedStations.length} control point{selectedStations.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold text-cyan-400 mb-4">TEAMS ({teams.length})</h2>
                {teams.length === 0 ? (
                  <p className="text-cyan-500">No teams created yet. Go to the Teams page to create teams.</p>
                ) : teams.length < 2 ? (
                  <p className="text-amber-400 border border-amber-500 rounded-md p-2 bg-amber-900/30">You need at least 2 teams to start a game.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className="cyber-card p-3 rounded-lg"
                        style={{ 
                          borderColor: team.color
                        }}
                      >
                        <div className="font-medium text-cyan-300">{team.name}</div>
                        <div className="text-sm text-cyan-500">READY</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-8">
                <button
                  onClick={startGame}
                  disabled={teams.length < 2}
                  className={`cyber-button w-full py-4 px-6 rounded-md font-semibold flex items-center justify-center gap-2 ${
                    teams.length < 2
                      ? 'bg-gray-900/60 text-gray-500 border-gray-700 cursor-not-allowed'
                      : 'bg-green-900/60 hover:bg-green-800 text-green-400 border-green-500 shadow-lg shadow-green-500/30'
                  }`}
                >
                  <PlayIcon className="h-5 w-5" />
                  INITIALIZE {GAME_TYPES.find(t => t.value === selectedGameType)?.label.toUpperCase()} ({selectedDuration}m)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
