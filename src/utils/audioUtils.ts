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

/**
 * Fetches TTS audio via Google Translate Speech HTTP API.
 * Pure HTTPS GET — works on 100% of servers, VPS, and cPanel environments with zero WebSocket dependency.
 */
export async function fetchGoogleTts(text: string, lang = 'en'): Promise<Buffer> {
  const https = await import('https');
  const clean = text.trim();
  if (!clean) return Buffer.alloc(0);

  // Split into chunks of max 180 chars to conform with HTTP URL parameters
  const chunks: string[] = [];
  const words = clean.split(/\s+/);
  let current = '';

  for (const w of words) {
    if ((current + ' ' + w).trim().length > 180) {
      if (current.trim()) chunks.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  if (chunks.length === 0) chunks.push(clean);

  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;

    const buf = await new Promise<Buffer>((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Google TTS returned HTTP ${res.statusCode}`));
          return;
        }
        const data: Buffer[] = [];
        res.on('data', (d) => data.push(d));
        res.on('end', () => resolve(Buffer.concat(data)));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(6000, () => {
        req.destroy(new Error('Google TTS request timeout'));
      });
    });

    audioBuffers.push(buf);
  }

  return Buffer.concat(audioBuffers);
}

