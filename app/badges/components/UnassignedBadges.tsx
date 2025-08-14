'use client'

import { TagIcon } from '@heroicons/react/24/outline'
import { Badge, Team } from '../../../lib/supabase'

interface UnassignedBadgesProps {
  badges: Badge[]
  teams: Team[]
  loading: boolean
  onUpdatePlayerName: (badgeId: string, playerName: string) => Promise<void>
  onAssignTeam: (badgeId: string, teamId: string | null) => Promise<void>
}

export default function UnassignedBadges({ 
  badges, 
  teams, 
  loading,
  onUpdatePlayerName, 
  onAssignTeam 
}: UnassignedBadgesProps) {
  const unassignedBadges = badges.filter(badge => !badge.team_id)
  
  console.log('[COMPONENT_DEBUG] Rendering UnassignedBadges with', unassignedBadges.length, 'badges')
  console.log('[COMPONENT_DEBUG] Unassigned badge UIDs:', unassignedBadges.map(b => b.rfid_uid).join(', '))

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600">
        Loading badges...
      </div>
    )
  }

  if (unassignedBadges.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600">
        All badges are assigned to teams.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {unassignedBadges.map((badge) => (
        <div key={badge.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TagIcon className="h-5 w-5 text-gray-400" />
            <span className="font-mono text-sm font-semibold">{badge.rfid_uid}</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Player Name
              </label>
              <input
                type="text"
                value={badge.player_name || ''}
                onChange={(e) => onUpdatePlayerName(badge.id, e.target.value)}
                placeholder="Enter player name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign to Team
              </label>
              <div className="relative">
                <select
                  value={badge.team_id || ''}
                  onChange={(e) => onAssignTeam(badge.id, e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm appearance-none bg-white"
                  style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  <option value="">Select team...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
