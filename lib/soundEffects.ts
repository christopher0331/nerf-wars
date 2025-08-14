/**
 * Sound effects management for NERF game system
 * Enhanced with ElevenLabs TTS integration
 */

import { elevenLabsTTS, VOICES } from './elevenLabsTTS'

// Sound effect categories
type SoundEffect = 'capture' | 'victory' | 'game_start' | 'warning'

// Volume level (0.0 to 1.0)
const DEFAULT_VOLUME = 0.7

// Cache for loaded audio elements
const audioCache: Record<string, HTMLAudioElement> = {}

// Debouncing for announcements to prevent duplicates
const announcementCache = new Map<string, number>()
const ANNOUNCEMENT_DEBOUNCE_MS = 2000 // 2 seconds

/**
 * Play a station capture announcement
 * @param stationName The name of the captured station
 * @param teamName The name of the capturing team
 * @returns Promise that resolves when audio starts playing
 */
export const playStationCaptured = async (stationName: string, teamName: string): Promise<void> => {
  try {
    const message = `${stationName} captured by ${teamName}`
    const cacheKey = `${stationName}_${teamName}`
    const now = Date.now()
    
    // Check if we recently played this exact announcement
    const lastPlayed = announcementCache.get(cacheKey)
    if (lastPlayed && (now - lastPlayed) < ANNOUNCEMENT_DEBOUNCE_MS) {
      console.log(`🚫 Skipping duplicate announcement: ${message} (played ${now - lastPlayed}ms ago)`)
      return
    }
    
    // Check if we're currently playing ANY station capture for this station
    const stationKey = `station_${stationName}`
    const lastStationAnnouncement = announcementCache.get(stationKey)
    if (lastStationAnnouncement && (now - lastStationAnnouncement) < ANNOUNCEMENT_DEBOUNCE_MS) {
      console.log(`🚫 Skipping station announcement: ${stationName} was announced ${now - lastStationAnnouncement}ms ago`)
      return
    }
    
    console.log(`🔊 Playing station capture: ${message}`)
    
    // Cache this announcement
    announcementCache.set(cacheKey, now)
    announcementCache.set(stationKey, now)
    
    return elevenLabsTTS.speak(message, VOICES.USER_VOICE)
  } catch (error) {
    console.error('Error playing station capture sound:', error)
    throw error
  }
}

/**
 * Play victory announcement
 * @param teamName The name of the winning team
 */
export const playVictory = async (teamName: string): Promise<void> => {
  try {
    const message = `Team ${teamName} is victorious`
    const cacheKey = `victory_${teamName}`
    const now = Date.now()
    
    // Check if we recently played this victory announcement
    const lastPlayed = announcementCache.get(cacheKey)
    if (lastPlayed && (now - lastPlayed) < ANNOUNCEMENT_DEBOUNCE_MS) {
      console.log(`🚫 Skipping duplicate victory announcement: ${message} (played ${now - lastPlayed}ms ago)`)
      return
    }
    
    console.log(`🏆 Playing victory announcement for team: ${teamName}`)
    
    // Cache this announcement
    announcementCache.set(cacheKey, now)
    
    return elevenLabsTTS.speak(message, VOICES.USER_VOICE)
  } catch (error) {
    console.error('Error playing victory sound:', error)
    throw error
  }
}

/**
 * Play game start announcement
 */
export const playGameStart = async (): Promise<void> => {
  return playAudio('/audio/game_start.mp3')
}

/**
 * Play warning sound
 * @param message Optional message to speak after the warning sound
 */
export const playWarning = async (message?: string): Promise<void> => {
  await playAudio('/audio/warning.mp3')
  if (message) {
    await speakText(message)
  }
}

/**
 * Helper to play audio file
 * @param audioPath Path to audio file
 */
const playAudio = (audioPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Use cached audio element or create a new one
      if (!audioCache[audioPath]) {
        audioCache[audioPath] = new Audio(audioPath)
        audioCache[audioPath].volume = DEFAULT_VOLUME
      }
      
      const audio = audioCache[audioPath]
      
      // Reset audio to start
      audio.currentTime = 0
      
      // Play the audio
      const playPromise = audio.play()
      
      // Handle play promise (may be rejected if user hasn't interacted with page)
      if (playPromise) {
        playPromise
          .then(() => resolve())
          .catch(error => {
            console.warn('Audio playback was prevented:', error)
            resolve() // Resolve anyway to avoid blocking
          })
      } else {
        resolve()
      }
    } catch (error) {
      console.error('Error playing audio:', error)
      reject(error)
    }
  })
}

/**
 * Speak text using ElevenLabs TTS (with browser fallback)
 * @param text Text to speak
 * @param useElevenLabs Whether to use ElevenLabs (default: true)
 */
export const speakText = async (text: string, useElevenLabs: boolean = true): Promise<void> => {
  try {
    console.log(`🎤 Speaking text: "${text}" (ElevenLabs: ${useElevenLabs})`)
    
    if (useElevenLabs) {
      return elevenLabsTTS.speak(text, VOICES.ARNOLD)
    }

    // Fallback to browser speech synthesis only if explicitly requested
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported')
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = DEFAULT_VOLUME

    // Speak the text
    return new Promise((resolve, reject) => {
      utterance.onend = () => resolve()
      utterance.onerror = (error) => reject(error)
      window.speechSynthesis.speak(utterance)
    })
  } catch (error) {
    console.error('Error speaking text:', error)
    throw error
  }
}

/**
 * Initialize the sound system - call this when user interacts with page
 * to enable audio playback
 */
export const initSounds = (): void => {
  // Create a silent audio context to initialize audio
  const audioContext = new AudioContext()
  const silence = audioContext.createBuffer(1, 1, 22050)
  const source = audioContext.createBufferSource()
  source.buffer = silence
  source.connect(audioContext.destination)
  source.start()
  
  // Pre-load some common sounds
  const commonSounds = [
    '/audio/game_start.mp3',
    '/audio/victory.mp3',
    '/audio/warning.mp3',
  ]
  
  commonSounds.forEach(path => {
    try {
      audioCache[path] = new Audio(path)
      // Just load it, don't play
      audioCache[path].load()
    } catch (e) {
      // Ignore errors for missing files
    }
  })
}
