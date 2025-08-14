import { TeamWithControl } from '../hooks/useTeamControls'
import { ShieldExclamationIcon } from '@heroicons/react/24/outline'

interface TeamProgressBarsProps {
  teamControls: TeamWithControl[]
}

export function TeamProgressBars({ teamControls }: TeamProgressBarsProps) {
  // Format time in seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="mb-10">
      <div className="flex items-center mb-4">
        <div className="h-px flex-grow bg-gradient-to-r from-transparent via-cyan-800 to-transparent"></div>
        <h2 className="text-xl font-bold mx-4 text-cyan-300 font-mono uppercase tracking-wider">Combat Progress</h2>
        <div className="h-px flex-grow bg-gradient-to-r from-cyan-800 via-transparent to-transparent"></div>
      </div>
      
      <div className="space-y-5">
        {teamControls.map((teamControl) => {
          // Customize opacity based on control percentage for visual interest
          const glowIntensity = teamControl.controlPercentage > 50 ? '50' : '30';
          const barGlow = teamControl.controlPercentage > 50 ? 'shadow-lg' : '';
          
          return (
            <div 
              key={teamControl.team.id} 
              className="rounded-md overflow-hidden backdrop-blur-sm p-0.5 relative"
              style={{ 
                background: `linear-gradient(90deg, ${teamControl.team.color}20, ${teamControl.team.color}05)`,
                boxShadow: teamControl.controlPercentage > 70 ? `0 0 20px ${teamControl.team.color}30` : 'none'
              }}
            >
              {/* Diagonal pattern overlay */}
              <div className="absolute inset-0 opacity-5 bg-diagonal-lines z-0"></div>
              
              {/* Progress bar contents */}
              <div className="bg-blue-900/20 backdrop-blur-sm relative z-10 p-4">
                <div className="flex justify-between mb-2">
                  <div className="flex items-center">
                    <div 
                      className="w-1 h-8 mr-3 rounded" 
                      style={{ backgroundColor: teamControl.team.color }}
                    ></div>
                    <div>
                      <div 
                        className="font-mono text-lg tracking-wider uppercase font-bold" 
                        style={{ color: teamControl.team.color }}
                      >
                        {teamControl.team.name}
                      </div>
                      <div className="text-sm font-mono mt-0.5 text-cyan-500">
                        {teamControl.activeStationCount > 0 ? (
                          <span className="flex items-center">
                            <ShieldExclamationIcon className="h-3 w-3 mr-1" />
                            CONTROLLING {teamControl.activeStationCount} ZONE{teamControl.activeStationCount !== 1 ? 'S' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400">NO ACTIVE CONTROL</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div 
                    className="font-mono font-medium text-xl"
                    style={{ color: teamControl.team.color }}
                  >
                    {formatTime(teamControl.controlTime)}
                  </div>
                </div>
                
                {/* Main progress bar */}
                <div className="w-full bg-gray-900/50 rounded-sm h-2 overflow-hidden backdrop-blur-sm border border-gray-700/50 mt-1">
                  <div 
                    className={`h-full transition-all duration-500 ease-out ${barGlow}`}
                    style={{ 
                      width: `${teamControl.controlPercentage}%`,
                      backgroundColor: teamControl.team.color,
                      boxShadow: `0 0 10px ${teamControl.team.color}${glowIntensity}`
                    }}
                  />
                </div>
                
                {/* Percentage marker */}
                <div className="flex justify-end mt-1">
                  <div className="text-xs text-cyan-600 font-mono">
                    {Math.floor(teamControl.controlPercentage)}% COMPLETE
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {teamControls.length === 0 && (
          <div className="text-gray-500 italic">No team data available</div>
        )}
      </div>
    </div>
  )
}
