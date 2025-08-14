'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Team, type Station } from '../../../lib/supabase'
import { playVictory } from '../../../lib/soundEffects'

// Sequence Game Types
interface SequenceGameConfig {
  game_id: string
  mode: 'FREE' | 'ORDERED'
  sequence: string[]
  multi_scan: Record<string, number>
  time_window_sec?: number
  wrong_scan_penalty: {
    type: 'reset_to_zero' | 'time_penalty' | 'none'
    seconds?: number
  }
  defender_reset: {
    mode: 'lock_last' | 'lock_current'
    cooldown_sec: number
  }
  win_rule: {
    type: 'first_to_finish' | 'most_points_when_time_ends'
  }
  max_duration_sec: number
}

interface TeamProgress {
  team_id: string
  team_name: string
  team_color: string
  idx: number
  points: number
  window_expires_at?: string
  last_update: string
  meta?: {
    visited?: string[]
    streak_count?: number
    cooldown_until?: string
  }
}

interface SequenceScan {
  scan_id: string
  station_id: string
  team_id: string
  rfid_uid: string
  outcome: 'PROGRESS' | 'WRONG_ORDER' | 'DEFENDER_LOCK' | 'ALREADY_DONE' | 'WIN' | 'HOLDING'
  ts: string
}

export default function SequenceGamePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [gameConfig, setGameConfig] = useState<SequenceGameConfig | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [teamProgress, setTeamProgress] = useState<TeamProgress[]>([])
  const [recentScans, setRecentScans] = useState<SequenceScan[]>([])
  const [gameStarted, setGameStarted] = useState(false)
  const [gameEnded, setGameEnded] = useState(false)
  const [winnerTeam, setWinnerTeam] = useState<Team | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  // Game setup state
  const [selectedStations, setSelectedStations] = useState<string[]>([])
  const [gameMode, setGameMode] = useState<'FREE' | 'ORDERED'>('ORDERED')
  const [sequenceOrder, setSequenceOrder] = useState<string[]>([])
  const [timeLimit, setTimeLimit] = useState(600) // 10 minutes default

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (gameStarted && !gameEnded) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            endGame()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [gameStarted, gameEnded])

  const loadInitialData = async () => {
    try {
      // Load teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name')

      if (teamsError) throw teamsError
      setTeams(teamsData || [])

      // Load stations
      const { data: stationsData, error: stationsError } = await supabase
        .from('stations')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (stationsError) throw stationsError
      setStations(stationsData || [])

    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createGameConfig = (): SequenceGameConfig => {
    const sequence = gameMode === 'ORDERED' ? sequenceOrder : []
    const multi_scan: Record<string, number> = {}
    
    // Default to 1 scan per station, could be configurable
    selectedStations.forEach(stationId => {
      multi_scan[stationId] = 1
    })

    return {
      game_id: `seq_${Date.now()}`,
      mode: gameMode,
      sequence,
      multi_scan,
      time_window_sec: gameMode === 'ORDERED' ? 60 : undefined,
      wrong_scan_penalty: {
        type: 'reset_to_zero'
      },
      defender_reset: {
        mode: 'lock_current',
        cooldown_sec: 15
      },
      win_rule: {
        type: 'first_to_finish'
      },
      max_duration_sec: timeLimit
    }
  }

  const startGame = async () => {
    if (selectedStations.length < 2) {
      alert('Please select at least 2 stations')
      return
    }

    if (gameMode === 'ORDERED' && sequenceOrder.length !== selectedStations.length) {
      alert('Please set the sequence order for all selected stations')
      return
    }

    try {
      const config = createGameConfig()
      setGameConfig(config)
      setGameStarted(true)
      setTimeRemaining(timeLimit)

      // Initialize team progress
      const initialProgress: TeamProgress[] = teams.map(team => ({
        team_id: team.id,
        team_name: team.name,
        team_color: team.color,
        idx: 0,
        points: 0,
        last_update: new Date().toISOString(),
        meta: {
          visited: [],
          streak_count: 0
        }
      }))
      setTeamProgress(initialProgress)

      console.log('🎮 Sequence Game Started:', config)
    } catch (error) {
      console.error('Error starting game:', error)
    }
  }

  const endGame = () => {
    setGameEnded(true)
    if (winnerTeam) {
      playVictory(winnerTeam.name).catch(console.error)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStationStatus = (stationId: string, teamId: string): string => {
    const progress = teamProgress.find(p => p.team_id === teamId)
    if (!progress || !gameConfig) return 'pending'

    if (gameConfig.mode === 'ORDERED') {
      const targetIndex = progress.idx
      const targetStation = gameConfig.sequence[targetIndex]
      if (stationId === targetStation) return 'current'
      if (gameConfig.sequence.indexOf(stationId) < targetIndex) return 'completed'
      return 'pending'
    } else {
      // FREE mode
      const visited = progress.meta?.visited || []
      return visited.includes(stationId) ? 'completed' : 'pending'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading Sequence Game...</div>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-black text-cyan-400 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center cyber-glow">
            SEQUENCE GAME SETUP
          </h1>

          {/* Game Mode Selection */}
          <div className="cyber-card p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Game Mode</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setGameMode('ORDERED')}
                className={`cyber-button px-6 py-3 ${gameMode === 'ORDERED' ? 'bg-cyan-600' : ''}`}
              >
                ORDERED - Teams must capture stations in sequence
              </button>
              <button
                onClick={() => setGameMode('FREE')}
                className={`cyber-button px-6 py-3 ${gameMode === 'FREE' ? 'bg-cyan-600' : ''}`}
              >
                FREE - Teams can capture stations in any order
              </button>
            </div>
          </div>

          {/* Station Selection */}
          <div className="cyber-card p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Select Stations</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {stations.map(station => (
                <label key={station.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStations.includes(station.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStations([...selectedStations, station.id])
                      } else {
                        setSelectedStations(selectedStations.filter(id => id !== station.id))
                        setSequenceOrder(sequenceOrder.filter(id => id !== station.id))
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-cyan-300">{station.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sequence Order (for ORDERED mode) */}
          {gameMode === 'ORDERED' && selectedStations.length > 0 && (
            <div className="cyber-card p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Set Sequence Order</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg mb-2">Available Stations</h3>
                  {selectedStations.filter(id => !sequenceOrder.includes(id)).map(stationId => {
                    const station = stations.find(s => s.id === stationId)
                    return (
                      <button
                        key={stationId}
                        onClick={() => setSequenceOrder([...sequenceOrder, stationId])}
                        className="cyber-button block w-full mb-2 text-left"
                      >
                        {station?.name}
                      </button>
                    )
                  })}
                </div>
                <div>
                  <h3 className="text-lg mb-2">Sequence Order</h3>
                  {sequenceOrder.map((stationId, index) => {
                    const station = stations.find(s => s.id === stationId)
                    return (
                      <div key={stationId} className="flex items-center justify-between mb-2 p-2 bg-gray-800 rounded">
                        <span>{index + 1}. {station?.name}</span>
                        <button
                          onClick={() => setSequenceOrder(sequenceOrder.filter(id => id !== stationId))}
                          className="text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Time Limit */}
          <div className="cyber-card p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Time Limit</h2>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={Math.floor(timeLimit / 60)}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) * 60)}
                className="bg-gray-800 text-cyan-300 p-2 rounded w-20"
                min="1"
                max="60"
              />
              <span>minutes</span>
            </div>
          </div>

          {/* Start Game Button */}
          <div className="text-center">
            <button
              onClick={startGame}
              disabled={selectedStations.length < 2}
              className="cyber-button px-8 py-4 text-xl disabled:opacity-50"
            >
              START SEQUENCE GAME
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-cyan-400 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Game Header */}
        <div className="cyber-card p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold cyber-glow">SEQUENCE GAME</h1>
              <div className="text-lg">Mode: {gameConfig?.mode} | Time: {formatTime(timeRemaining)}</div>
            </div>
            <button
              onClick={() => router.push('/games')}
              className="cyber-button px-4 py-2"
            >
              Exit Game
            </button>
          </div>
        </div>

        {/* Team Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {teamProgress.map(progress => (
            <div key={progress.team_id} className="cyber-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold" style={{ color: progress.team_color }}>
                  {progress.team_name}
                </h2>
                <div className="text-xl">
                  {gameConfig?.mode === 'ORDERED' 
                    ? `${progress.idx}/${gameConfig.sequence.length}`
                    : `${progress.points} points`
                  }
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-800 rounded-full h-4 mb-4">
                <div
                  className="h-4 rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: progress.team_color,
                    width: gameConfig?.mode === 'ORDERED'
                      ? `${(progress.idx / (gameConfig.sequence.length || 1)) * 100}%`
                      : `${(progress.points / selectedStations.length) * 100}%`
                  }}
                />
              </div>

              {/* Station Status */}
              <div className="grid grid-cols-2 gap-2">
                {(gameConfig?.mode === 'ORDERED' ? gameConfig.sequence : selectedStations).map((stationId, index) => {
                  const station = stations.find(s => s.id === stationId)
                  const status = getStationStatus(stationId, progress.team_id)
                  return (
                    <div
                      key={stationId}
                      className={`p-2 rounded text-center text-sm ${
                        status === 'completed' ? 'bg-green-800' :
                        status === 'current' ? 'bg-yellow-800' :
                        'bg-gray-800'
                      }`}
                    >
                      {gameConfig?.mode === 'ORDERED' && `${index + 1}. `}{station?.name}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Scans */}
        <div className="cyber-card p-6">
          <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentScans.length === 0 ? (
              <div className="text-gray-500">No scans yet...</div>
            ) : (
              recentScans.slice(-10).reverse().map((scan, index) => {
                const team = teams.find(t => t.id === scan.team_id)
                const station = stations.find(s => s.id === scan.station_id)
                return (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-800 rounded">
                    <span style={{ color: team?.color }}>{team?.name}</span>
                    <span>{station?.name}</span>
                    <span className={`text-sm ${
                      scan.outcome === 'PROGRESS' ? 'text-green-400' :
                      scan.outcome === 'WRONG_ORDER' ? 'text-red-400' :
                      scan.outcome === 'WIN' ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>
                      {scan.outcome}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Victory Modal */}
        {gameEnded && winnerTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="cyber-card p-8 max-w-md w-full mx-4 text-center">
              <h2 className="text-4xl font-bold mb-4 cyber-glow" style={{ color: winnerTeam.color }}>
                VICTORY!
              </h2>
              <p className="text-xl mb-6">
                {winnerTeam.name} has completed the sequence!
              </p>
              <button
                onClick={() => router.push('/games')}
                className="cyber-button px-6 py-3"
              >
                Return to Games
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
