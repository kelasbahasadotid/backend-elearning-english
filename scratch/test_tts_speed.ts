import { Communicate } from 'edge-tts-universal';

async function testTTS() {
  console.log('Testing Edge-TTS speed and connectivity...');
  const start = Date.now();
  try {
    const text = 'Hello! Welcome to the English Speaking Lesson.';
    const communicate = new Communicate(text, {
      voice: 'en-US-AvaNeural',
      rate: '+0%',
      pitch: '+0Hz'
    });

    let totalBytes = 0;
    let chunks = 0;
    let firstChunkTime = 0;

    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        if (chunks === 0) {
          firstChunkTime = Date.now() - start;
        }
        chunks++;
        totalBytes += chunk.data.length;
      }
    }

    const totalTime = Date.now() - start;
    console.log(`✅ TTS SUCCESS!`);
    console.log(`- First audio chunk latency: ${firstChunkTime}ms`);
    console.log(`- Total chunks: ${chunks}`);
    console.log(`- Total audio size: ${totalBytes} bytes`);
    console.log(`- Total completion time: ${totalTime}ms`);
  } catch (err: any) {
    console.error('❌ TTS ERROR:', err);
  }
}

testTTS();
