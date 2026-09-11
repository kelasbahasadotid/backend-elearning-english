import { convertMp3ToWav } from '../src/utils/audioUtils';
const { Communicate } = require('edge-tts-universal');

async function testWavConversion() {
  console.log('Testing Edge-TTS + convertMp3ToWav...');
  const start = Date.now();
  const communicate = new Communicate('Good morning, how are you today?', {
    voice: 'en-US-AvaNeural'
  });

  const chunks: Buffer[] = [];
  for await (const chunk of communicate.stream()) {
    if (chunk.type === 'audio' && chunk.data) {
      chunks.push(chunk.data);
    }
  }
  const mp3Buffer = Buffer.concat(chunks);
  console.log(`MP3 downloaded: ${mp3Buffer.length} bytes in ${Date.now() - start} ms`);

  const convStart = Date.now();
  const wavBuffer = await convertMp3ToWav(mp3Buffer);
  console.log(`WAV converted: ${wavBuffer.length} bytes in ${Date.now() - convStart} ms! Header: ${wavBuffer.slice(0, 4).toString()} / ${wavBuffer.slice(8, 12).toString()}`);

  process.exit(0);
}

testWavConversion().catch(err => {
  console.error(err);
  process.exit(1);
});
