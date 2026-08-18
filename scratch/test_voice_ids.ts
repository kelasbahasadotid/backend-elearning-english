async function testVoices() {
  const { Communicate } = require('edge-tts-universal');
  const voices = [
    'en-GB-EmmaNeural',
    'en-US-EmmaNeural',
    'en-GB-RyanNeural',
    'en-US-AvaNeural',
    'en-GB-SoniaNeural'
  ];

  for (const voice of voices) {
    try {
      const comm = new Communicate('Hello world', { voice });
      const chunks: Buffer[] = [];
      for await (const chunk of comm.stream()) {
        if (chunk.type === 'audio') chunks.push(chunk.data);
      }
      const buf = Buffer.concat(chunks);
      console.log(`Voice [${voice}]: SUCCESS -> ${buf.length} bytes`);
    } catch (e: any) {
      console.error(`Voice [${voice}]: FAILED ->`, e.message || e);
    }
  }
}
testVoices();
