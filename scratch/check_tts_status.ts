import fs from 'fs';
import path from 'path';

const TTS_CACHE_DIR = path.join(process.cwd(), 'uploads', 'tts_cache');
console.log('TTS Cache Dir exists:', fs.existsSync(TTS_CACHE_DIR));
if (fs.existsSync(TTS_CACHE_DIR)) {
  const files = fs.readdirSync(TTS_CACHE_DIR);
  console.log(`TTS Cached files count: ${files.length}`);
  files.slice(0, 5).forEach(f => console.log(' -', f));
}
