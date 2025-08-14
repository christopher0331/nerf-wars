'use client'

import { useState, useEffect } from 'react'
import { Team } from '../../../lib/supabase'
import { playVictory } from '../../../lib/soundEffects'

interface VictoryModalProps {
  winningTeam: Team
  isOpen: boolean
  onClose: () => void
  onReturnToGames: () => void
}

export function VictoryModal({ winningTeam, isOpen, onClose, onReturnToGames }: VictoryModalProps) {
  const [animateIn, setAnimateIn] = useState(false)
  
  useEffect(() => {
    if (isOpen) {
      // Trigger animation after component mounts
      const timer = setTimeout(() => {
        setAnimateIn(true)
      }, 100)
      
      // Play victory announcement
      console.log(`🔊 Playing victory announcement for team: ${winningTeam.name}`)
      playVictory(winningTeam.name).catch(error => {
        console.error('Error playing victory sound:', error)
      })
      
      return () => clearTimeout(timer)
    }
  }, [isOpen, winningTeam.name])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-80" onClick={onClose}></div>
      
      {/* Modal */}
      <div 
        className={`bg-gray-900 border-2 border-cyan-500 text-white p-8 rounded-lg w-full max-w-lg z-10 transform transition-all duration-500 ${
          animateIn 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
        {/* Header with electronic glitch effect */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-yellow-400 mb-3 cyber-glitch-effect">
            VICTORY
          </h2>
          <div className="h-1 w-24 mx-auto bg-cyan-500"></div>
        </div>
        
        {/* Team info */}
        <div className="text-center mb-6">
          <div className="text-2xl mb-2">
            <span className="text-gray-300">Team </span>
            <span 
              className="font-bold" 
              style={{ color: winningTeam.color || '#38bdf8' }}
            >
              {winningTeam.name}
            </span>
            <span className="text-gray-300"> has claimed victory!</span>
          </div>
          
          <p className="text-gray-400">
            All control points have been successfully secured and the mission is complete.
          </p>
        </div>
        
        {/* Victory stats */}
        <div className="bg-gray-800 p-4 rounded mb-6">
          <h3 className="text-cyan-400 mb-2 font-bold">Mission Statistics</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-gray-400">Team:</div>
            <div className="text-right text-white">{winningTeam.name}</div>
            
            <div className="text-gray-400">Victory Type:</div>
            <div className="text-right text-white">Zone Control</div>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            className="px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-cyan-500 text-cyan-400 rounded transition-colors"
            onClick={onClose}
          >
            Continue Viewing
          </button>
          
          <button
            className="px-6 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded transition-colors"
            onClick={onReturnToGames}
          >
            Return to Control Center
          </button>
        </div>
      </div>
    </div>
  )
}
