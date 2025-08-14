'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function TestDbPage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testConnection = async () => {
    setLoading(true)
    setError(null)
    setResults([])

    try {
      // Test basic connection
      console.log('Testing Supabase connection...')
      const { data, error } = await supabase.from('teams').select('*').limit(1)
      
      if (error) {
        console.error('Database error:', error)
        setError(`Database Error: ${error.message}`)
        return
      }

      console.log('Connection successful:', data)
      setResults([{ test: 'Connection', status: 'SUCCESS', data }])

    } catch (err: any) {
      console.error('Connection error:', err)
      setError(`Connection Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const createTestTeam = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('teams')
        .insert([{ name: 'Test Team', color: '#8B5CF6' }])
        .select()

      if (error) {
        setError(`Insert Error: ${error.message}`)
        return
      }

      console.log('Team created:', data)
      setResults(prev => [...prev, { test: 'Create Team', status: 'SUCCESS', data }])
    } catch (err: any) {
      setError(`Create Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Database Connection Test</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={testConnection}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Connection'}
        </button>
        
        <button
          onClick={createTestTeam}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 ml-4"
        >
          {loading ? 'Creating...' : 'Create Test Team'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <h3 className="font-medium text-red-800">Error:</h3>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <h3 className="font-medium text-green-800 mb-2">Results:</h3>
          {results.map((result, index) => (
            <div key={index} className="text-sm text-green-700 mb-2">
              <strong>{result.test}:</strong> {result.status}
              <pre className="mt-1 text-xs bg-white p-2 rounded">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-gray-50 rounded p-4">
        <h3 className="font-medium mb-2">Environment Check:</h3>
        <div className="text-sm space-y-1">
          <div>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</div>
          <div>Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</div>
        </div>
      </div>
    </div>
  )
}
