'use client'

import { useState, useEffect } from 'react'
import { supabase, type Station, type RfidScan } from '../../lib/supabase'
import { CpuChipIcon, SignalIcon, SignalSlashIcon } from '@heroicons/react/24/outline'

interface StationWithActivity extends Station {
  last_scan?: string
  scan_count: number
  is_online: boolean
}

export default function StationsPage() {
  const [stations, setStations] = useState<StationWithActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStations()
    // Set up real-time subscription for station activity
    const interval = setInterval(fetchStations, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchStations = async () => {
    try {
      // First get all stations
      const { data: stationsData, error: stationsError } = await supabase
        .from('stations')
        .select('*')
        .order('name', { ascending: true })

      if (stationsError) throw stationsError
      
      // Get all recent scans
      const { data: allScans, error: scansError } = await supabase
        .from('rfid_scans')
        .select('*')
        .order('scanned_at', { ascending: false })
      
      if (scansError) throw scansError
      console.log('All scans retrieved:', allScans?.length || 0)
      
      // Map station IDs to lookups
      const stationIdMap = {
        'Station 1': '04bc0dd5-a929-40f7-85d4-db99555b21db',
        'Station 3': 'e8a06b61-7a9e-4252-8606-cd6ebcc9f396'
      }
      
      // Get activity data for each station
      const stationsWithActivity = (stationsData || []).map(station => {
        const stationId = stationIdMap[station.name] || station.id || station.uuid
        console.log(`Processing station: ${station.name}, Looking for ID: ${stationId}`)
        
        // Filter scans for this station
        const stationScans = allScans?.filter(scan => scan.station_id === stationId) || []
        console.log(`Found ${stationScans.length} scans for station ${station.name}`)
        
        // Get most recent scan
        const lastScan = stationScans.length > 0 ? stationScans[0].scanned_at : null
        const lastScanTime = lastScan ? new Date(lastScan).getTime() : 0
        const currentTime = new Date().getTime()
        const timeSinceLastScan = currentTime - lastScanTime
        
        const isOnline = lastScan && timeSinceLastScan < 60000 // Online if scanned within last minute
        
        console.log(`Station ${station.name}: Last scan: ${lastScan ? new Date(lastScan).toLocaleTimeString() : 'Never'}, Online: ${isOnline}`)
        
        return {
          ...station,
          last_scan: lastScan,
          scan_count: stationScans.length,
          is_online: isOnline
        }
      })

      setStations(stationsWithActivity)
    } catch (error) {
      console.error('Error fetching stations:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStationName = async (stationId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('stations')
        .update({ name: newName })
        .eq('id', stationId)

      if (error) throw error
      fetchStations()
    } catch (error) {
      console.error('Error updating station name:', error)
    }
  }

  const updateStationLocation = async (stationId: string, newLocation: string) => {
    try {
      const { error } = await supabase
        .from('stations')
        .update({ location: newLocation })
        .eq('id', stationId)

      if (error) throw error
      fetchStations()
    } catch (error) {
      console.error('Error updating station location:', error)
    }
  }

  const toggleStationActive = async (stationId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('stations')
        .update({ is_active: !isActive })
        .eq('id', stationId)

      if (error) throw error
      fetchStations()
    } catch (error) {
      console.error('Error toggling station status:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-cyan-500 animate-pulse">INITIALIZING STATION DATA...</div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 bg-circuit-pattern">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-cyan-400 flex items-center">
            <CpuChipIcon className="h-8 w-8 mr-2 text-yellow-500" />
            STATION MANAGEMENT
          </h1>
          <p className="mt-2 text-sm text-cyan-600">
            Monitor and manage ESP32 RFID scanning stations
          </p>
        </div>
      </div>

      {/* Stations Grid */}
      <div className="mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stations.map((station) => (
            <div
              key={station.id}
              className={`cyber-card rounded-lg p-6 ${
                station.is_active 
                  ? 'border-green-400 bg-black/80 shadow-lg shadow-green-500/20' 
                  : 'border-cyan-700 bg-black/80 shadow-lg shadow-cyan-500/20'
              }`}
            >
              {/* Station Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {station.is_online ? (
                    <SignalIcon className="h-6 w-6 text-green-400 mr-2 animate-pulse" />
                  ) : (
                    <SignalSlashIcon className="h-6 w-6 text-red-400 mr-2" />
                  )}
                  <input
                    type="text"
                    defaultValue={station.name}
                    onBlur={(e) => {
                      if (e.target.value !== station.name) {
                        updateStationName(station.id, e.target.value)
                      }
                    }}
                    className="cyber-input text-lg font-semibold text-cyan-300 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded px-1"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                    station.is_online 
                      ? 'bg-green-900/60 text-green-400 border-green-400' 
                      : 'bg-red-900/60 text-red-400 border-red-400'
                  }`}>
                    {station.is_online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </div>

              {/* Station Details */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-cyan-500">UUID</label>
                  <p className="text-sm text-cyan-200 font-mono bg-black/60 border border-cyan-700 p-2 rounded">
                    {station.uuid}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyan-500">Location</label>
                  <input
                    type="text"
                    defaultValue={station.location || ''}
                    placeholder="Enter location..."
                    onBlur={(e) => {
                      if (e.target.value !== station.location) {
                        updateStationLocation(station.id, e.target.value)
                      }
                    }}
                    className="cyber-input mt-1 block w-full text-sm rounded-md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="border border-cyan-700 p-2 rounded-md bg-black/40">
                    <label className="block text-sm font-medium text-cyan-500">Total Scans</label>
                    <p className="text-2xl font-bold text-yellow-400">{station.scan_count}</p>
                  </div>
                  <div className="border border-cyan-700 p-2 rounded-md bg-black/40">
                    <label className="block text-sm font-medium text-cyan-500">Last Scan</label>
                    <p className="text-sm text-cyan-300">
                      {station.last_scan 
                        ? new Date(station.last_scan).toLocaleTimeString()
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Station Actions */}
              <div className="mt-6 flex space-x-2">
                <button
                  onClick={() => toggleStationActive(station.id, station.is_active)}
                  className={`cyber-button flex-1 px-3 py-2 text-sm font-medium rounded-md ${
                    station.is_active
                      ? 'bg-red-900/60 text-red-400 border-red-500 hover:bg-red-800'
                      : 'bg-green-900/60 text-green-400 border-green-500 hover:bg-green-800'
                  }`}
                >
                  {station.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {stations.length === 0 && (
          <div className="text-center py-12 border border-dashed border-cyan-700 rounded-lg bg-black/40">
            <CpuChipIcon className="mx-auto h-12 w-12 text-cyan-600" />
            <h3 className="mt-2 text-sm font-medium text-cyan-400">NO STATIONS FOUND</h3>
            <p className="mt-1 text-sm text-cyan-600">
              Stations will appear here automatically when they start sending RFID scans.
            </p>
          </div>
        )}
      </div>

      {/* Station Status Legend */}
      <div className="mt-8 bg-black/60 border border-cyan-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-cyan-400 mb-2">STATUS LEGEND</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center">
            <SignalIcon className="h-4 w-4 text-green-400 mr-2 animate-pulse" />
            <span className="text-cyan-300"><strong className="text-green-400">ONLINE:</strong> Scanned within the last minute</span>
          </div>
          <div className="flex items-center">
            <SignalSlashIcon className="h-4 w-4 text-red-400 mr-2" />
            <span className="text-cyan-300"><strong className="text-red-400">OFFLINE:</strong> No recent activity</span>
          </div>
        </div>
      </div>
    </div>
  )
}
