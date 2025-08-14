'use client'

import { useState } from 'react'
import { elevenLabsTTS, VOICES } from '../../lib/elevenLabsTTS'
import { playStationCaptured, speakText } from '../../lib/soundEffects'

export default function AudioTestPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<string[]>([])

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testBrowserTTS = async () => {
    setIsLoading(true)
    addResult('Testing browser TTS...')
    try {
      await speakText('Testing browser text to speech', false) // Force browser TTS
      addResult('✅ Browser TTS test completed')
    } catch (error) {
      addResult(`❌ Browser TTS failed: ${error}`)
    }
    setIsLoading(false)
  }

  const testElevenLabsTTS = async () => {
    setIsLoading(true)
    addResult('Testing ElevenLabs TTS...')
    try {
      await elevenLabsTTS.speak('Testing ElevenLabs text to speech', VOICES.ARNOLD)
      addResult('✅ ElevenLabs TTS test completed')
    } catch (error) {
      addResult(`❌ ElevenLabs TTS failed: ${error}`)
    }
    setIsLoading(false)
  }

  const testServerTTS = async () => {
    setIsLoading(true)
    addResult('Testing server-side TTS API...')
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Testing server TTS API', voiceId: VOICES.ARNOLD })
      })
      
      if (response.ok) {
        const audioBuffer = await response.arrayBuffer()
        addResult(`✅ Server TTS API working, got ${audioBuffer.byteLength} bytes`)
        
        // Try to play the audio
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const audioBufferDecoded = await audioContext.decodeAudioData(audioBuffer)
        const source = audioContext.createBufferSource()
        source.buffer = audioBufferDecoded
        source.connect(audioContext.destination)
        source.start(0)
        addResult('✅ Audio playback started')
      } else {
        const error = await response.json()
        addResult(`❌ Server TTS API failed: ${response.status} - ${error.error}`)
      }
    } catch (error) {
      addResult(`❌ Server TTS API error: ${error}`)
    }
    setIsLoading(false)
  }

  const testStationCapture = async () => {
    setIsLoading(true)
    addResult('Testing station capture announcement...')
    try {
      await playStationCaptured('Station 1', 'Team Alpha')
      addResult('✅ Station capture test completed')
    } catch (error) {
      addResult(`❌ Station capture failed: ${error}`)
    }
    setIsLoading(false)
  }

  const testAPIKey = async () => {
    addResult('Testing API key availability...')
    try {
      // Test the server-side API key by making a test call
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' })
      })
      
      if (response.status === 500) {
        const error = await response.json()
        if (error.error.includes('API key not configured')) {
          addResult('❌ ElevenLabs API key not configured on server')
        } else {
          addResult(`❌ Server error: ${error.error}`)
        }
      } else if (response.status === 400) {
        addResult('✅ ElevenLabs API key is configured (got expected 400 for empty text)')
      } else {
        addResult(`✅ ElevenLabs API key is working (status: ${response.status})`)
      }
    } catch (error) {
      addResult(`❌ Error testing API key: ${error}`)
    }
  }

  const checkAudioContext = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContext) {
        const ctx = new AudioContext()
        addResult(`✅ Audio Context available, state: ${ctx.state}`)
        if (ctx.state === 'suspended') {
          addResult('⚠️ Audio Context is suspended - user interaction required')
        }
      } else {
        addResult('❌ Audio Context not supported')
      }
    } catch (error) {
      addResult(`❌ Audio Context error: ${error}`)
    }
  }

  const initializeAudio = async () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') {
        await ctx.resume()
        addResult('✅ Audio Context resumed')
      }
    } catch (error) {
      addResult(`❌ Failed to initialize audio: ${error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-cyan-400">Audio System Test</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-cyan-300">System Checks</h2>
            <div className="space-y-2">
              <button
                onClick={testAPIKey}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Check API Key
              </button>
              <button
                onClick={checkAudioContext}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Check Audio Context
              </button>
              <button
                onClick={initializeAudio}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
              >
                Initialize Audio
              </button>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-cyan-300">Audio Tests</h2>
            <div className="space-y-2">
              <button
                onClick={testBrowserTTS}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors disabled:opacity-50"
              >
                Test Browser TTS
              </button>
              <button
                onClick={testElevenLabsTTS}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded transition-colors disabled:opacity-50"
              >
                Test ElevenLabs TTS
              </button>
              <button
                onClick={testServerTTS}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors disabled:opacity-50"
              >
                Test Server TTS API
              </button>
              <button
                onClick={testStationCapture}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50"
              >
                Test Station Capture
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-cyan-300">Test Results</h2>
          <div className="bg-black p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <div className="text-gray-400">No tests run yet. Click buttons above to test audio system.</div>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="mb-1">
                  {result}
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => setTestResults([])}
            className="mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
          >
            Clear Results
          </button>
        </div>

        <div className="mt-8 p-4 bg-yellow-900 border border-yellow-600 rounded">
          <h3 className="font-bold text-yellow-300 mb-2">Troubleshooting Tips:</h3>
          <ul className="text-yellow-100 space-y-1 text-sm">
            <li>• Make sure to click "Initialize Audio" first</li>
            <li>• Check browser console for detailed error messages</li>
            <li>• Ensure your ElevenLabs API key is valid</li>
            <li>• Try refreshing the page if audio context is suspended</li>
            <li>• Some browsers require user interaction before playing audio</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
