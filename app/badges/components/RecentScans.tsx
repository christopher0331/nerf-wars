'use client'

import { ClockIcon, TagIcon } from '@heroicons/react/24/outline'
import { RfidScanWithStation } from '../hooks/useRfidScans'

interface RecentScansProps {
  recentScans: RfidScanWithStation[]
  loading: boolean
}

export default function RecentScans({ recentScans, loading }: RecentScansProps) {
  console.log('[COMPONENT_DEBUG] Rendering RecentScans with', recentScans.length, 'scans')
  
  // Render scan IDs for debugging
  console.log('[COMPONENT_DEBUG] Scan IDs:', recentScans.map(s => s.id).join(', '))
  
  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600">
        Loading recent scans...
      </div>
    )
  }

  if (recentScans.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600">
        No recent scans. Scan an RFID badge at any station to see it appear here.
      </div>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {recentScans.map((scan, index) => (
          <div key={`${scan.id}-${index}`} className="flex items-center justify-between bg-white p-3 rounded border">
            <div className="flex items-center gap-3">
              <TagIcon className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-mono text-sm font-semibold">{scan.uid}</div>
                <div className="text-xs text-gray-600">
                  Station {scan.station_id === '04bc0dd5-a929-40f7-85d4-db99555b21db' ? '1' : scan.station_id === 'e8a06b61-7a9e-4252-8606-cd6ebcc9f396' ? '3' : 'Unknown'} • {new Date(scan.scanned_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              {Math.floor((Date.now() - new Date(scan.scanned_at).getTime()) / 1000)}s ago
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
