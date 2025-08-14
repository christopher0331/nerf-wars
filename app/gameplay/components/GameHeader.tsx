import { Game } from "../../../lib/supabase"
import { ShieldCheckIcon } from "@heroicons/react/24/outline"

interface GameHeaderProps {
  activeGame: Game | null
  loading: boolean
  error: string | null
  stopGame: () => Promise<void>
}

export function GameHeader({ activeGame, loading, error, stopGame }: GameHeaderProps) {
  if (loading) {
    return (
      <div className="py-4 text-center text-cyan-300 animate-pulse">
        <span className="inline-block animate-spin mr-2">⟳</span>
        Initializing UNSC Combat Interface...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-4 text-center text-red-400">
        <span className="font-mono tracking-wide">ERROR://</span> {error}
      </div>
    )
  }

  if (!activeGame) {
    return (
      <div className="py-4 text-center text-yellow-400 font-mono">
        NO ACTIVE COMBAT SESSION DETECTED
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="bg-cyan-900/30 border border-cyan-500/50 p-2 rounded-full">
            <ShieldCheckIcon className="h-7 w-7 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center">
              <h1 className="text-xl font-mono uppercase tracking-wider text-cyan-300 font-bold">
                KING OF THE HILL
              </h1>
              <span className="ml-2 text-xs bg-cyan-900/50 text-cyan-400 px-2 py-1 rounded-full border border-cyan-800 font-mono">
                ACTIVE
              </span>
            </div>
            <p className="text-cyan-500 text-sm font-mono tracking-wide">
              {activeGame.name} <span className="text-cyan-700">// COMBAT SEQUENCE ENGAGED</span>
            </p>
          </div>
        </div>
        
        <button 
          onClick={stopGame}
          className="bg-red-900/80 hover:bg-red-700 text-red-300 border border-red-500 px-4 py-2 rounded font-mono uppercase tracking-wider shadow-lg shadow-red-900/30 transition-all hover:shadow-red-700/50"
        >
          TERMINATE SESSION
        </button>
      </div>
    </div>
  )
}
