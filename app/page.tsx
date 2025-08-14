'use client'

import { useState, useEffect } from 'react'
import { supabase, type Team, type Badge } from '../lib/supabase'
import { PlusIcon, PencilIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/outline'

const TEAM_COLORS = [
  { name: 'Neon Purple', value: '#8B5CF6', bg: 'bg-purple-900/30', border: 'border-purple-500/50', text: 'text-purple-300' },
  { name: 'Neon Green', value: '#10B981', bg: 'bg-green-900/30', border: 'border-green-500/50', text: 'text-green-300' },
  { name: 'Neon Red', value: '#EF4444', bg: 'bg-red-900/30', border: 'border-red-500/50', text: 'text-red-300' },
  { name: 'Neon Blue', value: '#3B82F6', bg: 'bg-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-300' },
  { name: 'Neon Yellow', value: '#F59E0B', bg: 'bg-yellow-900/30', border: 'border-yellow-500/50', text: 'text-yellow-300' },
  { name: 'Neon Pink', value: '#EC4899', bg: 'bg-pink-900/30', border: 'border-pink-500/50', text: 'text-pink-300' },
]

interface TeamWithBadges extends Team {
  badge_count: number
  badges: Badge[]
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithBadges[]>([])
  const [unassignedBadges, setUnassignedBadges] = useState<Badge[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedColor, setSelectedColor] = useState(TEAM_COLORS[0])
  const [loading, setLoading] = useState(true)
  
  // Team editing state
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const [editingTeamColor, setEditingTeamColor] = useState(TEAM_COLORS[0])

  useEffect(() => {
    fetchTeams()
    fetchUnassignedBadges()
  }, [])

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: true })

      if (teamsError) throw teamsError

      // Fetch badge counts for each team
      const teamsWithBadges = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { data: badges, error: badgesError } = await supabase
            .from('badges')
            .select('*')
            .eq('team_id', team.id)

          if (badgesError) throw badgesError

          return {
            ...team,
            badge_count: badges?.length || 0,
            badges: badges || []
          }
        })
      )

      setTeams(teamsWithBadges)
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUnassignedBadges = async () => {
    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .is('team_id', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      setUnassignedBadges(data || [])
    } catch (error) {
      console.error('Error fetching unassigned badges:', error)
    }
  }

  const createTeam = async () => {
    if (!newTeamName.trim()) return

    try {
      const { data, error } = await supabase
        .from('teams')
        .insert([
          {
            name: newTeamName.trim(),
            color: selectedColor.value
          }
        ])
        .select()

      if (error) throw error

      setNewTeamName('')
      setSelectedColor(TEAM_COLORS[0])
      setShowCreateModal(false)
      fetchTeams()
    } catch (error) {
      console.error('Error creating team:', error)
    }
  }

  const deleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? All badges will be unassigned.')) return
    
    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId)
        
      if (error) throw error
      fetchTeams()
      fetchUnassignedBadges()
    } catch (error) {
      console.error('Error deleting team:', error)
    }
  }
  
  const startEditingTeam = (team: TeamWithBadges) => {
    setEditingTeamId(team.id)
    setEditingTeamName(team.name)
    setEditingTeamColor(TEAM_COLORS.find(c => c.value === team.color) || TEAM_COLORS[0])
  }
  
  const cancelEditingTeam = () => {
    setEditingTeamId(null)
    setEditingTeamName('')
    setEditingTeamColor(TEAM_COLORS[0])
  }
  
  const updateTeam = async () => {
    if (!editingTeamId || !editingTeamName.trim()) return
    
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: editingTeamName.trim(),
          color: editingTeamColor.value
        })
        .eq('id', editingTeamId)
      
      if (error) throw error
      
      cancelEditingTeam()
      fetchTeams()
    } catch (error) {
      console.error('Error updating team:', error)
    }
  }

  const getColorClasses = (color: string) => {
    const colorObj = TEAM_COLORS.find(c => c.value === color) || TEAM_COLORS[0]
    return colorObj
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading teams...</div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 bg-circuit-pattern min-h-screen">
      {/* Header */}
      <div className="sm:flex sm:items-center border-b-2 border-cyan-700/50 pb-4 mb-6">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-cyan-400 flex items-center">
            <UserGroupIcon className="h-8 w-8 mr-2 text-cyan-500" />
            TACTICAL UNITS
          </h1>
          <p className="mt-2 text-sm text-cyan-500 font-mono">
            MANAGE TEAMS AND ASSIGN RFID BADGES TO PLAYERS
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            className="cyber-button inline-flex items-center justify-center rounded-md px-4 py-2 sm:w-auto"
            onClick={() => setShowCreateModal(true)}
          >
            <PlusIcon className="-ml-1 mr-2 h-4 w-4" />
            CREATE TEAM
          </button>
        </div>
      </div>

      {/* Team Management Section */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-cyan-400 mb-4 font-mono">TACTICAL UNIT MANAGEMENT</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => {
            const colorClasses = getColorClasses(team.color)
            return (
              <div
                key={team.id}
                className={`cyber-card rounded-lg border-2 ${colorClasses.border} p-6 relative`}
              >
                {/* Team Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: team.color }}
                    />
                    <h3 className={`text-lg font-semibold ${colorClasses.text}`}>
                      Team {team.name}
                    </h3>
                  </div>
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => startEditingTeam(team)}
                      className="p-1 text-cyan-500 hover:text-cyan-300 bg-cyan-900/20 rounded border border-cyan-800/30"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => deleteTeam(team.id)}
                      className="p-1 text-red-500 hover:text-red-300 bg-red-900/20 rounded border border-red-800/30"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Badge Count */}
                <div className="text-right mb-4 border-b border-cyan-800/40 pb-2">
                  <span className={`text-sm font-medium ${colorClasses.text} font-mono`}>
                    {team.badge_count} RFID{team.badge_count !== 1 ? 's' : ''} <span className="text-cyan-600">// ASSIGNED</span>
                  </span>
                </div>

                {/* Team Members */}
                <div className="space-y-2 mb-4">
                  {team.badges.map((badge) => (
                    <div key={badge.id} className="flex items-center justify-between border-b border-cyan-900/30 py-2">
                      <span className={`text-sm ${colorClasses.text} font-mono`}>
                        {badge.player_name || '<UNNAMED_AGENT>'}
                      </span>
                      <div className="flex space-x-2">
                        <button className="text-xs text-cyan-600 hover:text-cyan-400 bg-cyan-900/10 px-2 py-1 rounded border border-cyan-900/30">
                          LABEL
                        </button>
                        <button className="text-xs text-red-500 hover:text-red-400 bg-red-900/10 px-2 py-1 rounded border border-red-900/30">
                          REMOVE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2 mt-4">
                  <button className="flex-1 cyber-button">
                    ADD RFID
                  </button>
                  <button className="cyber-button-red">
                    DELETE TEAM
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Unassigned RFIDs Section */}
        {unassignedBadges.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-medium text-cyan-400 mb-4 font-mono">UNASSIGNED RFIDS</h2>
            <p className="text-sm text-cyan-500 mb-4 font-mono">
              SELECT TEAM FOR EACH RFID AND CLICK ASSIGN
            </p>
            
            <div className="cyber-card shadow-lg rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-3">
                  {unassignedBadges.map((badge) => (
                    <div key={badge.id} className="flex items-center justify-between py-2 border-b border-cyan-900/30 last:border-b-0">
                      <div>
                        <span className="text-sm font-medium text-cyan-400 font-mono">
                          {badge.player_name || '<UNNAMED_BADGE>'}
                        </span>
                        <span className="ml-2 text-xs text-cyan-600">
                          [{badge.rfid_uid}]
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <select className="text-sm bg-black/80 border-2 border-cyan-800/50 text-cyan-400 rounded-md focus:ring-cyan-500 focus:border-cyan-500">
                          <option value="">SELECT TEAM...</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id} className="bg-black text-cyan-400">
                              UNIT {team.name}
                            </option>
                          ))}
                        </select>
                        <button className="text-sm cyber-button px-3 py-1 rounded-md">
                          ASSIGN
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Team Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
              <div className="fixed inset-0 bg-black bg-opacity-80 transition-opacity backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>

              <div className="inline-block align-middle bg-blue-900/20 backdrop-blur-sm border border-cyan-800/50 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-gradient-to-b from-blue-900/40 to-blue-900/20 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 relative">
                  <div className="absolute inset-0 bg-diagonal-lines opacity-20 pointer-events-none"></div>
                  <div className="relative z-10">
                    <div className="border-b border-cyan-800/50 pb-3 mb-4">
                      <h3 className="text-lg leading-6 font-mono uppercase text-cyan-300 tracking-wider">Create New Team</h3>
                      <p className="text-xs text-cyan-500 font-mono">TACTICAL UNIT FORMATION</p>
                    </div>

                    <div className="mb-4">
                      <label htmlFor="teamName" className="block text-sm font-mono text-cyan-400 mb-1">TEAM NAME</label>
                      <input
                        type="text"
                        id="teamName"
                        className="cyber-input w-full rounded"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-mono text-cyan-400 mb-2">TEAM COLOR</label>
                      <div className="grid grid-cols-3 gap-2">
                        {TEAM_COLORS.map((color) => (
                          <button
                            key={color.name}
                            type="button"
                            className={`w-full p-2 rounded-md ${color.bg} ${color.border} hover:brightness-125 transition-all duration-300 ${selectedColor.name === color.name ? 'ring-2 ring-offset-1 ring-cyan-400' : ''}`}
                            onClick={() => setSelectedColor(color)}
                          >
                            <div className={`text-center ${color.text} text-sm font-mono uppercase`}>{color.name.split(' ')[1]}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900/30 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-cyan-800/50">
                  <button
                    type="button"
                    className="cyber-button glow-cyan w-full sm:w-auto sm:ml-3"
                    onClick={createTeam}
                  >
                    Create Team
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full sm:w-auto sm:mt-0 sm:ml-3 border border-cyan-700/50 bg-transparent text-cyan-400 px-4 py-2 rounded hover:bg-cyan-900/20 hover:text-cyan-300 transition-all duration-300 font-mono text-sm uppercase"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Edit Team Modal */}
        {editingTeamId && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
              <div className="fixed inset-0 bg-black bg-opacity-80 transition-opacity backdrop-blur-sm" onClick={() => setEditingTeamId(null)}></div>

              <div className="inline-block align-middle bg-blue-900/20 backdrop-blur-sm border border-cyan-800/50 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-gradient-to-b from-blue-900/40 to-blue-900/20 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 relative">
                  <div className="absolute inset-0 bg-diagonal-lines opacity-20 pointer-events-none"></div>
                  <div className="relative z-10">
                    <div className="border-b border-cyan-800/50 pb-3 mb-4">
                      <h3 className="text-lg leading-6 font-mono uppercase text-cyan-300 tracking-wider">Edit Team</h3>
                      <p className="text-xs text-cyan-500 font-mono">MODIFY TACTICAL UNIT</p>
                    </div>

                    <div className="mb-4">
                      <label htmlFor="editTeamName" className="block text-sm font-mono text-cyan-400 mb-1">TEAM NAME</label>
                      <input
                        type="text"
                        id="editTeamName"
                        className="cyber-input w-full rounded"
                        value={editingTeamName}
                        onChange={(e) => setEditingTeamName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-mono text-cyan-400 mb-2">TEAM COLOR</label>
                      <div className="grid grid-cols-3 gap-2">
                        {TEAM_COLORS.map((color) => (
                          <button
                            key={color.name}
                            type="button"
                            className={`w-full p-2 rounded-md ${color.bg} ${color.border} hover:brightness-125 transition-all duration-300 ${editingTeamColor.name === color.name ? 'ring-2 ring-offset-1 ring-cyan-400' : ''}`}
                            onClick={() => setEditingTeamColor(color)}
                          >
                            <div className={`text-center ${color.text} text-sm font-mono uppercase`}>{color.name.split(' ')[1]}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900/30 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-cyan-800/50">
                  <button
                    type="button"
                    className="cyber-button glow-cyan w-full sm:w-auto sm:ml-3"
                    onClick={updateTeam}
                  >
                    Update Team
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full sm:w-auto sm:mt-0 sm:ml-3 border border-cyan-700/50 bg-transparent text-cyan-400 px-4 py-2 rounded hover:bg-cyan-900/20 hover:text-cyan-300 transition-all duration-300 font-mono text-sm uppercase"
                    onClick={() => setEditingTeamId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
