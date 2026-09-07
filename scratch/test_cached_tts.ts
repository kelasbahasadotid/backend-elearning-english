import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Communicate } from 'edge-tts-universal';

const cacheDir = path.join(process.cwd(), 'uploads', 'tts_cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

async function getOrSynthesizeAudio(text: string, voice = 'en-US-AvaNeural', rate = '+0%', pitch = '+0Hz'): Promise<Buffer> {
  const hash = crypto.createHash('md5').update(`${voice}__${rate}__${pitch}__${text}`).digest('hex');
  const cacheFile = path.join(cacheDir, `${hash}.mp3`);

  if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 0) {
    console.log(`⚡ [Cache HIT] Loaded ${hash}.mp3 from local disk in ~1ms`);
    return fs.readFileSync(cacheFile);
  }

  console.log(`🌐 [Cache MISS] Generating from Edge-TTS cloud for: "${text.substring(0, 30)}..."`);
  const start = Date.now();
  const comm = new Communicate(text, { voice, rate, pitch });
  const chunks: Buffer[] = [];

  for await (const chunk of comm.stream()) {
    if (chunk.type === 'audio' && chunk.data) {
      chunks.push(chunk.data);
    }
  }

  const audioBuffer = Buffer.concat(chunks);
  fs.writeFileSync(cacheFile, audioBuffer);
  console.log(`💾 Saved to cache (${audioBuffer.length} bytes in ${Date.now() - start}ms)`);
  return audioBuffer;
}

async function test() {
  console.log('--- 1st Call (Cloud Miss) ---');
  const t1 = Date.now();
  await getOrSynthesizeAudio('Welcome to our English learning class.');
  console.log(`1st Call Total: ${Date.now() - t1}ms\n`);

  console.log('--- 2nd Call (Cache Hit) ---');
  const t2 = Date.now();
  await getOrSynthesizeAudio('Welcome to our English learning class.');
  console.log(`2nd Call Total: ${Date.now() - t2}ms\n`);
}

test();
