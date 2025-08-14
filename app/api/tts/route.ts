import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId = 'VR6AewLTigWG4xSOukaG' } = await request.json()
    
    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.ELEVEN_LABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 })
    }

    console.log('Generating TTS for:', text)

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true
        }
      })
    })

    if (!response.ok) {
      console.error('ElevenLabs API error:', response.status, response.statusText)
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status} ${response.statusText}` }, 
        { status: response.status }
      )
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    })

  } catch (error) {
    console.error('TTS API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
