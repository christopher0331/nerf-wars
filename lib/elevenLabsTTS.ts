/**
 * ElevenLabs Text-to-Speech Service
 * Provides high-quality voice synthesis for game announcements
 */

interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
}

// Voice IDs for ElevenLabs
const VOICES = {
  RACHEL: 'AZnzlk1XvdvUeBnXmlld', // Clear, professional female voice
  ADAM: 'pNInz6obpgDQGcFmaJgB',   // Deep, authoritative male voice
  ANTONI: 'ErXwobaYiN019PkySvjV', // Warm, friendly male voice
  BELLA: 'EXAVITQu4vr4xnSDxMaL',  // Young, energetic female voice
  JOSH: 'TxGEqnHWrfWFTfGW9XjX',   // Professional male narrator
  ARNOLD: 'VR6AewLTigWG4xSOukaG', // Strong, commanding voice (like Schwarzenegger)
  SAM: 'yoZ06aMxZJJ28mfd3POQ',    // Calm, clear male voice
  USER_VOICE: '7S1SJHjwFTdQE8txKqM0' // User's custom cloned voice
}

class ElevenLabsTTSService {
  private apiKey: string
  private baseUrl = 'https://api.elevenlabs.io/v1'
  private defaultVoice = VOICES.USER_VOICE // Use user's custom voice for game announcements

  constructor() {
    this.apiKey = process.env.ELEVEN_LABS_API_KEY || ''
    if (!this.apiKey) {
      console.warn('ElevenLabs API key not found. TTS will be disabled.')
    }
  }

  /**
   * Generate speech from text using server-side ElevenLabs API
   */
  async generateSpeech(
    text: string, 
    voiceId: string = this.defaultVoice,
    options: {
      stability?: number
      similarity_boost?: number
      style?: number
      use_speaker_boost?: boolean
    } = {}
  ): Promise<ArrayBuffer | null> {
    try {
      console.log('Generating speech via server API:', text)
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceId,
          options
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`TTS API error: ${response.status} - ${errorData.error}`)
      }

      return await response.arrayBuffer()
    } catch (error) {
      console.error('Error generating speech:', error)
      return null
    }
  }

  /**
   * Play generated speech audio
   */
  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBufferDecoded = await audioContext.decodeAudioData(audioBuffer)
      
      const source = audioContext.createBufferSource()
      source.buffer = audioBufferDecoded
      source.connect(audioContext.destination)
      source.start(0)
    } catch (error) {
      console.error('Error playing audio:', error)
    }
  }

  /**
   * Generate and play speech in one call
   */
  async speak(
    text: string, 
    voiceId?: string, 
    options?: {
      stability?: number
      similarity_boost?: number
      style?: number
      use_speaker_boost?: boolean
    }
  ): Promise<void> {
    const audioBuffer = await this.generateSpeech(text, voiceId, options)
    if (audioBuffer) {
      await this.playAudio(audioBuffer)
    }
  }

  /**
   * Get available voices (requires API call)
   */
  async getVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.apiKey) {
      return []
    }

    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`)
      }

      const data = await response.json()
      return data.voices || []
    } catch (error) {
      console.error('Error fetching voices:', error)
      return []
    }
  }
}

// Export singleton instance
export const elevenLabsTTS = new ElevenLabsTTSService()

// Export voice constants for easy access
export { VOICES }

// Export types
export type { ElevenLabsVoice }
