import { ShieldCheckIcon, SignalIcon, ClockIcon } from '@heroicons/react/24/outline'
import { StationWithControl } from '../hooks/useStationControl'

interface ControlPointsProps {
  gameStations: StationWithControl[]
  updateCounter: number
}

export function ControlPoints({ gameStations, updateCounter }: ControlPointsProps) {
  return (
    <div>
      <div className="flex items-center mb-6">
        <div className="h-px flex-grow bg-gradient-to-r from-transparent via-cyan-800 to-transparent"></div>
        <h2 className="text-xl font-bold mx-4 text-cyan-300 font-mono uppercase tracking-wider">Control Zones</h2>
        <div className="h-px flex-grow bg-gradient-to-r from-cyan-800 via-transparent to-transparent"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gameStations.map((stationWithControl) => {
          const station = stationWithControl.station
          const team = stationWithControl.controllingTeam
          
          // Log render for debugging
          console.log(`[RENDER] Station ${station.name}: controlled=${!!team}, team=${team?.name || 'none'}, updateCounter=${updateCounter}`)
          
          // Determine if the station was recently captured (within the last 30 seconds)
          const isRecentlyCaptured = stationWithControl.controlStartTime && 
            (Date.now() - new Date(stationWithControl.controlStartTime).getTime() < 30000);
          
          return (
            <div 
              key={station.id} 
              className={`
                relative rounded border transition-all duration-300
                backdrop-blur-sm overflow-hidden
                ${isRecentlyCaptured ? 'animate-pulse' : ''}
              `}
              style={{ 
                backgroundColor: team ? `${team.color}15` : 'rgba(13, 25, 40, 0.6)',
                borderColor: team ? team.color : '#2d4b65',
                boxShadow: team ? `0 0 15px ${team.color}40` : 'none'
              }}
            >
              {/* Status indicator dot */}
              <div 
                className={`absolute top-3 right-3 h-2 w-2 rounded-full ${isRecentlyCaptured ? 'animate-ping' : ''}`}
                style={{ backgroundColor: team ? team.color : '#4f5b69' }}
              ></div>
              
              {/* Decorative corner elements */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor: team ? team.color : '#2d4b65' }}></div>
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor: team ? team.color : '#2d4b65' }}></div>
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l" style={{ borderColor: team ? team.color : '#2d4b65' }}></div>
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r" style={{ borderColor: team ? team.color : '#2d4b65' }}></div>
              
              {/* Diagonal pattern overlay */}
              <div className="absolute inset-0 opacity-5 bg-circuit-pattern"></div>
              
              {/* Content */}
              <div className="p-5 relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="bg-blue-900/30 border border-cyan-800 p-1.5 rounded mr-2">
                      <ShieldCheckIcon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <h3 className="font-mono font-bold text-lg tracking-wide text-cyan-100">{station.name}</h3>
                  </div>
                </div>
                
                {/* Control status */}
                <div 
                  className={`
                    flex items-center justify-center py-3 px-4 my-3 border font-mono font-bold
                    ${team ? 'bg-opacity-10' : 'bg-blue-900/20 border-blue-800/50'}
                  `}
                  style={{
                    backgroundColor: team ? team.color : undefined,
                    borderColor: team ? `${team.color}60` : undefined,
                    color: team ? team.color : '#4f8cba',
                  }}
                >
                  {team ? (
                    <>
                      <span className="uppercase tracking-wider">{team.name} CONTROL</span>
                      <div 
                        className="ml-2 h-3 w-3 rounded-full animate-pulse" 
                        style={{backgroundColor: team.color}}
                      ></div>
                    </>
                  ) : (
                    <span className="uppercase tracking-wider text-cyan-700">ZONE CONTESTED</span>
                  )}
                </div>
                
                {/* Additional station info */}
                <div className="text-xs text-cyan-600 font-mono space-y-1 mt-3">
                  <div className="flex items-center">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    LAST CONTROL: {stationWithControl.controlStartTime ? new Date(stationWithControl.controlStartTime).toLocaleTimeString() : 'NEVER'}
                  </div>
                  <div className="flex items-center">
                    <SignalIcon className="h-3 w-3 mr-1" />
                    STATUS: {team ? 'ACTIVE CONTROL' : 'NEUTRAL'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {gameStations.length === 0 && (
        <div className="text-cyan-600 text-center py-8 font-mono border border-cyan-900 bg-blue-900/20 rounded">
          NO ACTIVE ZONES DETECTED FOR THIS COMBAT SEQUENCE
        </div>
      )}
    </div>
  )
}
