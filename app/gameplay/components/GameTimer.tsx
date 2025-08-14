import { useEffect, useRef } from 'react'
import { ClockIcon } from '@heroicons/react/24/outline'

interface GameTimerProps {
  gameTimeRemaining: number
  updateGameTimeRemaining: () => number
  stopGame: () => Promise<void>
  activeSession: any
}

export function GameTimer({ 
  gameTimeRemaining, 
  updateGameTimeRemaining,
  stopGame,
  activeSession
}: GameTimerProps) {
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  
  // Set up timer interval
  useEffect(() => {
    // Set up timer to update every second
    timerInterval.current = setInterval(() => {
      const remaining = updateGameTimeRemaining()
      
      // If time is up, stop the game
      if (remaining !== undefined && remaining <= 0) {
        stopGame()
      }
    }, 1000)
    
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [])
  
  // Format time as mm:ss
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage for timer animation (based on elapsed time)
  const progressPercentage = () => {
    // This assumes the game typically goes for 30 minutes max before someone wins
    const elapsedMs = Date.now() - (new Date(activeSession?.start_time || Date.now())).getTime()
    const elapsedSeconds = Math.floor(elapsedMs / 1000)
    const maxSeconds = 1800 // 30 minutes max
    return Math.min(100, (elapsedSeconds / maxSeconds) * 100)
  }

  return (
    <div className="flex flex-col items-center mb-10">
      {/* Main timer display */}
      <div className="relative w-64 h-24 bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-lg border border-cyan-600/50 flex items-center justify-center shadow-lg shadow-cyan-900/20 overflow-hidden mb-2">
        {/* Animated progress bar */}
        <div 
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000"
          style={{ width: `${progressPercentage()}%` }}
        ></div>
        
        {/* Hexagon pattern overlay */}
        <div className="absolute inset-0 opacity-10 bg-hexagon-pattern"></div>
        
        {/* Timer content */}
        <div className="flex items-center justify-center z-10">
          <ClockIcon className="h-8 w-8 text-cyan-400 mr-3" />
          <div>
            <div className="text-xs text-cyan-500 mb-1 font-mono">MISSION TIME ELAPSED</div>
            <div className="text-4xl font-bold text-cyan-300 font-mono tracking-widest">
              {formatTime(Date.now() - (new Date(activeSession?.start_time || Date.now())).getTime())}
            </div>
          </div>
        </div>

        {/* Top highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
      </div>

      {/* Optional warning message after a long time */}
      {Date.now() - (new Date(activeSession?.start_time || Date.now())).getTime() > 25 * 60000 && (
        <div className="text-yellow-400 text-sm font-mono animate-pulse mt-1">
          MISSION EXTENDED: CAPTURE ZONES TO WIN
        </div>
      )}
    </div>
  )
}
