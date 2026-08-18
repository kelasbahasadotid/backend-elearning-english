async function testSSMLBreak() {
  const { Communicate } = require('edge-tts-universal');

  // Generate short silence/pause with Edge-TTS or blank buffer
  try {
    const text = 'Hello world! This is a test with natural emotion.';
    const comm = new Communicate(text, {
      voice: 'en-US-EmmaNeural',
      rate: '+0%',
      pitch: '+4Hz'
    });
    const chunks: Buffer[] = [];
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio') chunks.push(chunk.data);
    }
    console.log('Emma neural audio generated successfully:', Buffer.concat(chunks).length, 'bytes');
  } catch (e) {
    console.error(e);
  }
}
testSSMLBreak();
