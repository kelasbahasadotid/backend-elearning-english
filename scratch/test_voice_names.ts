import { Communicate } from 'edge-tts-universal';

async function testVoice(voice: string) {
  console.log(`Testing: ${voice}...`);
  const start = Date.now();
  try {
    const comm = new Communicate('Hello world', { voice });
    let bytes = 0;
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        bytes += chunk.data.length;
      }
    }
    console.log(`-> Result for ${voice}: ${bytes} bytes in ${Date.now() - start}ms`);
  } catch (err: any) {
    console.error(`-> Error for ${voice}: ${err.message} in ${Date.now() - start}ms`);
  }
}

async function run() {
  await testVoice('en-US-AvaMultilingualNeural');
  await testVoice('en-US-AvaNeural');
  await testVoice('en-US-AndrewMultilingualNeural');
  await testVoice('en-GB-SoniaNeural');
  await testVoice('en-GB-RyanNeural');
  await testVoice('id-ID-GadisNeural');
}

run();
