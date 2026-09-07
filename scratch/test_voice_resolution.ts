import { Communicate } from 'edge-tts-universal';

// Voice Normalizer Map that maps all legacy/short names to genuine Edge-TTS Neural Voices
export const VOICE_ALIAS_MAP: Record<string, string> = {
  // US Voices
  'en-US-AvaNeural': 'en-US-AvaNeural',
  'en-US-AvaMultilingualNeural': 'en-US-AvaMultilingualNeural',
  'en-US-AndrewNeural': 'en-US-AndrewMultilingualNeural',
  'en-US-AndrewMultilingualNeural': 'en-US-AndrewMultilingualNeural',
  'en-US-EmmaNeural': 'en-US-EmmaMultilingualNeural',
  'en-US-EmmaMultilingualNeural': 'en-US-EmmaMultilingualNeural',
  'en-US-BrianNeural': 'en-US-BrianMultilingualNeural',
  'en-US-BrianMultilingualNeural': 'en-US-BrianMultilingualNeural',
  'en-US-AnaNeural': 'en-US-AnaNeural',
  'en-US-GuyNeural': 'en-US-GuyNeural',
  'en-US-AriaNeural': 'en-US-AriaNeural',
  'en-US-JennyNeural': 'en-US-JennyNeural',
  'en-US-ChristopherNeural': 'en-US-ChristopherNeural',
  'en-US-EricNeural': 'en-US-EricNeural',
  'en-US-MichelleNeural': 'en-US-MichelleNeural',
  'en-US-RogerNeural': 'en-US-RogerNeural',
  'en-US-SteffanNeural': 'en-US-SteffanNeural',

  // UK British Voices
  'en-GB-SoniaNeural': 'en-GB-SoniaNeural',
  'en-GB-RyanNeural': 'en-GB-RyanNeural',
  'en-GB-LibbyNeural': 'en-GB-LibbyNeural',
  'en-GB-MaisieNeural': 'en-GB-MaisieNeural',
  'en-GB-ThomasNeural': 'en-GB-ThomasNeural',
  'en-GB-OliverNeural': 'en-GB-OliverNeural',

  // AU Australian Voices
  'en-AU-NatashaNeural': 'en-AU-NatashaNeural',
  'en-AU-WilliamNeural': 'en-AU-WilliamNeural',

  // Indonesian Voices
  'id-ID-GadisNeural': 'id-ID-GadisNeural',
  'id-ID-ArdiNeural': 'id-ID-ArdiNeural'
};

export function resolveVoice(voiceName: string): string {
  if (!voiceName) return 'en-US-AvaNeural';
  const clean = voiceName.trim();
  if (VOICE_ALIAS_MAP[clean]) {
    return VOICE_ALIAS_MAP[clean];
  }
  // Try case insensitive match
  const found = Object.keys(VOICE_ALIAS_MAP).find(k => k.toLowerCase() === clean.toLowerCase());
  if (found) return VOICE_ALIAS_MAP[found];
  return clean;
}

async function testAll() {
  const voices = [
    'en-US-AvaNeural',
    'en-US-AndrewNeural',
    'en-US-EmmaNeural',
    'en-US-BrianNeural',
    'en-US-GuyNeural',
    'en-GB-RyanNeural',
    'en-GB-SoniaNeural',
    'en-AU-NatashaNeural',
    'id-ID-GadisNeural'
  ];

  for (const v of voices) {
    const resolved = resolveVoice(v);
    const start = Date.now();
    try {
      const comm = new Communicate('Testing voice accent.', { voice: resolved });
      let bytes = 0;
      for await (const chunk of comm.stream()) {
        if (chunk.type === 'audio' && chunk.data) bytes += chunk.data.length;
      }
      console.log(`✅ [Input: "${v}" -> Resolved: "${resolved}"]: ${bytes} bytes in ${Date.now() - start}ms`);
    } catch (e: any) {
      console.error(`❌ [Input: "${v}" -> Resolved: "${resolved}"]: FAILED - ${e.message}`);
    }
  }
}

testAll();
