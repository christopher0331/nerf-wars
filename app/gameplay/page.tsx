'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import './styles/index.ts'
import { useGameData } from './hooks/useGameData'
import { useStationControl } from './hooks/useStationControl'
import { useTeamControls } from './hooks/useTeamControls'
import { GameHeader } from './components/GameHeader'
import { GameTimer } from './components/GameTimer'
import { TeamProgressBars } from './components/TeamProgressBars'
import { ControlPoints } from './components/ControlPoints'
import { VictoryModal } from './components/VictoryModal'

export default function GameplayPage() {
  const router = useRouter()
  // Track UI updates
  const [updateCounter, setUpdateCounter] = useState<number>(0)
  
  // Function to force UI updates
  const forceUIUpdate = () => {
    console.log('🔄 Forcing UI update')
    setUpdateCounter(prevCount => prevCount + 1)
  }
  
  // Use hooks for data and logic
  const { 
    loading, 
    error, 
    activeGame, 
    activeSession, 
    teams,
    activeStations,
    gameTimeRemaining,
    updateGameTimeRemaining,
    stopGame
  } = useGameData()
  
  // Handle station control
  const { gameStations } = useStationControl(
    activeSession,
    activeStations,
    teams
  )
  
  // Handle team control calculations
  const { teamControls, winningTeam, showVictoryModal, closeVictoryModal, setShowVictoryModal } = useTeamControls(
    teams,
    activeSession,
    activeGame,
    gameStations,
    stopGame
  )

  // Render UI with the extracted components
  return (
    <div className="min-h-screen bg-black bg-opacity-90 text-cyan-400 pb-20">
      {/* Cyberpunk/Halo style header bar */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 border-b-2 border-cyan-500 shadow-lg shadow-cyan-500/30 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-2">
          {/* Game header with title and stop button */}
          <GameHeader 
            activeGame={activeGame}
            loading={loading}
            error={error}
            stopGame={stopGame}
          />
        </div>
      </div>
      
      <div className="container mx-auto px-4 pt-8 pb-4 max-w-5xl">
        {/* Game timer */}
        <GameTimer 
          gameTimeRemaining={gameTimeRemaining}
          updateGameTimeRemaining={updateGameTimeRemaining}
          stopGame={stopGame}
          activeSession={activeSession}
        />
        
        {/* Team progress bars */}
        <TeamProgressBars 
          teamControls={teamControls}
        />
        
        {/* Victory is now handled by the modal */}
        
        {/* Control points grid */}
        <ControlPoints 
          gameStations={gameStations}
          updateCounter={updateCounter}
        />
        
        {/* Control zones list */}
        <div className="mt-10">
          <h2 className="text-lg text-cyan-300 mb-4 font-mono">CONTROL ZONES</h2>
        </div>
      </div>
      
      {/* Cyberpunk grid overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-grid-pattern opacity-5"></div>
      
      {/* Victory modal */}
      {winningTeam && (
        <VictoryModal 
          winningTeam={winningTeam}
          isOpen={showVictoryModal}
          onClose={closeVictoryModal}
          onReturnToGames={() => {
            setShowVictoryModal(false)
            stopGame()
          }}
        />
      )}
    </div>
  )
}
