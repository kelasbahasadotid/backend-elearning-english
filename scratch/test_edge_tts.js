const { Communicate } = require('edge-tts-universal');

async function testStream() {
  const comm = new Communicate('Hello! Welcome to Global English Speaking AI practice.', { voice: 'en-US-AvaNeural' });
  console.log('Communicate prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(comm)));

  try {
    const audioBuffer = await comm.stream();
    console.log('Stream result:', audioBuffer);
  } catch (e) {
    console.log('stream error:', e.message);
  }
  
  try {
    const stream = comm.stream();
    let chunks = [];
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio') {
        chunks.push(chunk.data);
      }
    }
    const finalBuffer = Buffer.concat(chunks);
    console.log('Successfully generated mp3 audio buffer! Byte size:', finalBuffer.length);
  } catch (e) {
    console.error('Error reading stream:', e);
  }
}

testStream();
