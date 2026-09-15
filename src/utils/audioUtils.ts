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

/**
 * Fetches Neural TTS audio via Official Microsoft Azure Speech REST API.
 * Pure HTTPS POST — zero WebSocket requirement, 100% allowed on all cPanel/LiteSpeed hosts!
 * Uses the exact same Neural voices (en-GB-RyanNeural, en-US-JennyNeural, etc.)
 */
export async function fetchAzureTts(text: string, voice: string, key?: string, region?: string): Promise<Buffer> {
  const apiKey = key || process.env.AZURE_SPEECH_KEY;
  const apiRegion = region || process.env.AZURE_SPEECH_REGION || 'southeastasia';
  if (!apiKey) return Buffer.alloc(0);

  const https = await import('https');
  const ssml = `<speak version='1.0' xml:lang='en-US'><voice name='${voice}'>${text}</voice></speak>`;

  return new Promise<Buffer>((resolve, reject) => {
    const options = {
      hostname: `${apiRegion}.tts.speech.microsoft.com`,
      path: '/cognitiveservices/v1',
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'backend-elearning-english',
        'Content-Length': Buffer.byteLength(ssml)
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Azure TTS HTTP error ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Azure TTS timeout'));
    });

    req.write(ssml);
    req.end();
  });
}

/**
 * Fetches binary audio buffer from a remote HTTPS URL (e.g. Cloudflare Worker bridge).
 * Pure HTTPS GET — 100% allowed on all cPanel/LiteSpeed hosts.
 */
export async function fetchHttpBuffer(urlStr: string, timeoutMs = 10000): Promise<Buffer> {
  const https = await import('https');
  const http = await import('http');
  const url = new URL(urlStr);
  const client = url.protocol === 'https:' ? https : http;

  return new Promise<Buffer>((resolve, reject) => {
    const req = client.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
      }
    }, (res: any) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHttpBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Bridge returned status ${res.statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (d: Buffer) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTP Bridge request timeout (${timeoutMs}ms)`));
    });
  });
}

/**
 * Synthesizes audio using Cloudflare Edge-TTS Bridge Worker via HTTPS.
 * Solves datacenter IP blocks and WebSocket restrictions on cPanel/LiteSpeed hosts.
 */
export async function fetchEdgeTtsBridge(
  text: string,
  voice = 'en-US-EmmaNeural',
  rate = '+0%',
  pitch = '+0Hz'
): Promise<Buffer | null> {
  const bridgeEndpoint = process.env.EDGE_TTS_BRIDGE_URL || 'https://cloudflare-edge-tts.kelasbahasadotid.workers.dev/tts';
  const cleanText = (text || '').trim();
  if (!cleanText) return null;

  try {
    const url = new URL(bridgeEndpoint);
    url.searchParams.set('text', cleanText);
    url.searchParams.set('voice', voice);
    if (rate && rate !== '+0%') url.searchParams.set('rate', rate);
    if (pitch && pitch !== '+0Hz') url.searchParams.set('pitch', pitch);

    const buf = await fetchHttpBuffer(url.toString(), 12000);
    if (buf && buf.length > 0) {
      return buf;
    }
  } catch (err: any) {
    console.warn('[TTS Bridge] Cloudflare Edge-TTS Worker call error:', err?.message || err);
  }
  return null;
}



