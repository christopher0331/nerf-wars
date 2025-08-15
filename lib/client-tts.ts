// Client-side TTS utility for static export compatibility
// This bypasses the need for API routes by making direct calls to ElevenLabs from the browser

export interface TTSOptions {
  voiceId?: string
  stability?: number
  similarityBoost?: number
  style?: number
  useSpeakerBoost?: boolean
}

export class ClientTTS {
  private apiKey: string | null = null

  constructor() {
    // In a static export, we need to get the API key from environment variables
    // that are available at build time (NEXT_PUBLIC_ prefixed)
    this.apiKey = process.env.NEXT_PUBLIC_ELEVEN_LABS_API_KEY || null
    console.log('ClientTTS initialized with API key:', !!this.apiKey)
    if (this.apiKey) {
      console.log('API key length:', this.apiKey.length)
      console.log('API key starts with sk_:', this.apiKey.startsWith('sk_'))
    }
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    // Cancel any existing speech synthesis to prevent dual voices
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
    
    if (!this.apiKey) {
      console.error('ElevenLabs API key not configured - no TTS available')
      // No fallback - ogre voice only or nothing
      throw new Error('ElevenLabs API key not configured')
    }

    const {
      voiceId = '7S1SJHjwFTdQE8txKqM0', // Default to ogre voice for everything
      stability = 0.6,
      similarityBoost = 0.8,
      style = 0.2,
      useSpeakerBoost = true
    } = options

    try {
      console.log('Generating client-side TTS for:', text)

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost
          }
        })
      })

      if (!response.ok) {
        console.error('ElevenLabs API error:', response.status, response.statusText)
        // Fallback to browser TTS on API failure
        return this.fallbackTTS(text)
      }

      const audioBuffer = await response.arrayBuffer()
      await this.playAudioBuffer(audioBuffer)

    } catch (error) {
      console.error('Client TTS error:', error)
      // No fallback - ogre voice only or nothing
      throw error
    }
  }

  private async playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBufferDecoded = await audioContext.decodeAudioData(audioBuffer)
      const source = audioContext.createBufferSource()
      source.buffer = audioBufferDecoded
      source.connect(audioContext.destination)
      source.start(0)

      // Return a promise that resolves when audio finishes playing
      return new Promise((resolve) => {
        source.onended = () => resolve()
      })
    } catch (error) {
      console.error('Audio playback error:', error)
      throw error
    }
  }

  private async fallbackTTS(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if ('speechSynthesis' in window) {
        // Cancel any existing speech synthesis to prevent dual voices
        speechSynthesis.cancel()
        
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.onend = () => resolve()
        utterance.onerror = (error) => reject(error)
        speechSynthesis.speak(utterance)
      } else {
        console.warn('No TTS available - neither ElevenLabs nor browser TTS')
        resolve()
      }
    })
  }

  // Test if the API key is working
  async testApiKey(): Promise<boolean> {
    if (!this.apiKey) return false

    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey
        }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Export a singleton instance
export const clientTTS = new ClientTTS()

// Voice constants - ALL VOICES SET TO OGRE VOICE
export const VOICES = {
  ARNOLD: '7S1SJHjwFTdQE8txKqM0', // Ogre voice for everything
  USER_VOICE: '7S1SJHjwFTdQE8txKqM0', // Ogre voice for everything
  OGRE: '7S1SJHjwFTdQE8txKqM0', // Ogre voice for everything
  // All voices use the ogre voice ID
} as const
