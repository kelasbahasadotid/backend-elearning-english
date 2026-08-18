async function testTts() {
  try {
    const { Communicate } = require('edge-tts-universal');
    const text = 'Good morning! How are you today?';
    const communicate = new Communicate(text, {
      voice: 'en-GB-SoniaNeural',
      rate: '+0%',
      pitch: '+0Hz'
    });

    const chunks: Buffer[] = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio') {
        chunks.push(chunk.data);
      }
    }
    const audioBuffer = Buffer.concat(chunks);
    console.log('Synthesized SoniaNeural audio buffer size:', audioBuffer.length, 'bytes');
  } catch (e) {
    console.error('TTS error:', e);
  }
}
testTts();
