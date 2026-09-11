const { Communicate } = require('edge-tts-universal');

async function testTts() {
  console.log('Testing Edge-TTS Communicate...');
  const start = Date.now();
  try {
    const communicate = new Communicate('Hello world, this is an English speaking practice test.', {
      voice: 'en-US-AvaNeural'
    });

    let chunkCount = 0;
    let totalBytes = 0;

    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        if (chunkCount === 0) {
          console.log(`First audio chunk received in ${Date.now() - start} ms!`);
        }
        chunkCount++;
        totalBytes += chunk.data.length;
      }
    }

    console.log(`TTS finished in ${Date.now() - start} ms! Total chunks: ${chunkCount}, Total bytes: ${totalBytes}`);
  } catch (err: any) {
    console.error(`TTS failed after ${Date.now() - start} ms:`, err.message);
  }
  process.exit(0);
}

testTts();
