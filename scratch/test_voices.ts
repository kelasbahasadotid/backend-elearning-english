import { Communicate } from 'edge-tts-universal';

const voicesToTest = [
  'en-US-AvaNeural',
  'en-US-AndrewNeural',
  'en-US-EmmaNeural',
  'en-US-BrianNeural',
  'en-GB-RyanNeural',
  'en-GB-SoniaNeural',
  'en-AU-NatashaNeural',
  'en-AU-WilliamNeural',
  'id-ID-GadisNeural',
  'id-ID-ArdiNeural'
];

async function testVoices() {
  console.log('Testing voice validity in Edge-TTS:');
  for (const voice of voicesToTest) {
    const start = Date.now();
    try {
      const comm = new Communicate('Test sound', { voice });
      let bytes = 0;
      for await (const chunk of comm.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
          bytes += chunk.data.length;
        }
      }
      const elapsed = Date.now() - start;
      if (bytes > 0) {
        console.log(`✅ [${voice}] - OK (${bytes} bytes in ${elapsed}ms)`);
      } else {
        console.warn(`⚠️ [${voice}] - Empty audio (${elapsed}ms)`);
      }
    } catch (e: any) {
      console.error(`❌ [${voice}] - FAILED: ${e.message}`);
    }
  }
}

testVoices();
