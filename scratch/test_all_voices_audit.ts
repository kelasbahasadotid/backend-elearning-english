import { Communicate } from 'edge-tts-universal';

const allFrontendVoices = [
  'en-GB-SoniaNeural',
  'en-GB-RyanNeural',
  'en-GB-LibbyNeural',
  'en-GB-MaisieNeural',
  'en-GB-ThomasNeural',
  'en-GB-OliverNeural',
  'en-US-AvaNeural',
  'en-US-AvaMultilingualNeural',
  'en-US-AndrewNeural',
  'en-US-AndrewMultilingualNeural',
  'en-US-EmmaNeural',
  'en-US-EmmaMultilingualNeural',
  'en-US-BrianNeural',
  'en-US-BrianMultilingualNeural',
  'en-US-AnaNeural',
  'en-US-GuyNeural',
  'en-US-AriaNeural',
  'en-US-JennyNeural',
  'en-US-ChristopherNeural',
  'en-US-EricNeural',
  'en-US-MichelleNeural',
  'en-US-RogerNeural',
  'en-US-SteffanNeural',
  'en-AU-NatashaNeural',
  'en-AU-WilliamNeural',
  'en-CA-ClaraNeural',
  'en-CA-LiamNeural',
  'en-IN-NeerjaNeural',
  'id-ID-GadisNeural',
  'id-ID-ArdiNeural'
];

async function benchmark() {
  console.log(`Auditing ${allFrontendVoices.length} voices with Edge-TTS...`);
  const working: string[] = [];
  const failing: string[] = [];

  for (const voice of allFrontendVoices) {
    const start = Date.now();
    try {
      const comm = new Communicate('Hello, this is a test audio.', { voice });
      let bytes = 0;
      for await (const chunk of comm.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
          bytes += chunk.data.length;
        }
      }
      const elapsed = Date.now() - start;
      if (bytes > 0) {
        console.log(`✅ [${voice}]: SUCCESS (${bytes} bytes in ${elapsed}ms)`);
        working.push(voice);
      } else {
        console.log(`⚠️ [${voice}]: ZERO BYTES (${elapsed}ms)`);
        failing.push(voice);
      }
    } catch (e: any) {
      console.log(`❌ [${voice}]: ERROR: ${e.message}`);
      failing.push(voice);
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log('WORKING VOICES:', working);
  console.log('FAILING VOICES:', failing);
}

benchmark();
