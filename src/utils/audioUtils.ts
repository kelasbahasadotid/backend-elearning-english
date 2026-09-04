import { MPEGDecoder } from 'mpg123-decoder';

/**
 * Converts an MP3 Buffer into a standard RIFF/WAVE (16-bit PCM) Buffer.
 * Compatible with all hosting environments, cPanel, and browsers with zero delay.
 */
export async function convertMp3ToWav(mp3Buffer: Buffer): Promise<Buffer> {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const { channelData, samplesDecoded, sampleRate } = decoder.decode(mp3Buffer);

  const numChannels = channelData.length || 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samplesDecoded * blockAlign;
  const headerSize = 44;
  const wavBuffer = Buffer.alloc(headerSize + dataSize);

  // 1. RIFF chunk descriptor
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write('WAVE', 8);

  // 2. "fmt " sub-chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);          // Subchunk1Size (16 for PCM)
  wavBuffer.writeUInt16LE(1, 20);           // AudioFormat (1 = PCM uncompressed)
  wavBuffer.writeUInt16LE(numChannels, 22); // NumChannels (1 = mono, 2 = stereo)
  wavBuffer.writeUInt32LE(sampleRate, 24);  // SampleRate (e.g. 24000 Hz)
  wavBuffer.writeUInt32LE(byteRate, 28);    // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  wavBuffer.writeUInt16LE(blockAlign, 32);  // BlockAlign (NumChannels * BitsPerSample/8)
  wavBuffer.writeUInt16LE(16, 34);          // BitsPerSample (16 bits)

  // 3. "data" sub-chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);

  // Write 16-bit interleaved PCM samples
  let offset = 44;
  for (let i = 0; i < samplesDecoded; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      wavBuffer.writeInt16LE(Math.round(int16), offset);
      offset += 2;
    }
  }

  decoder.free();
  return wavBuffer;
}
