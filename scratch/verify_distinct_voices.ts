import { resolveVoice, CURATED_VOICES } from '../src/utils/voiceUtils';

console.log(`Total Curated Voices: ${CURATED_VOICES.length}`);
CURATED_VOICES.forEach(v => {
  const mapped = resolveVoice(v.id);
  console.log(`- ID: "${v.id}" -> Resolved Edge-TTS: "${mapped}" (${v.gender}, ${v.locale}, ${v.name})`);
});
