import { getVoices } from 'edge-tts-universal';

async function listVoices() {
  try {
    const voices = await getVoices();
    console.log(`Total Edge-TTS voices returned: ${voices.length}`);
    const englishVoices = voices.filter((v: any) => v.Locale && (v.Locale.startsWith('en-') || v.Locale.startsWith('id-')));
    console.log(`Total English & Indonesian voices: ${englishVoices.length}`);
    englishVoices.forEach((v: any) => {
      console.log(`- ShortName: "${v.ShortName}", FriendlyName: "${v.FriendlyName}", Gender: "${v.Gender}", Locale: "${v.Locale}"`);
    });
  } catch (e: any) {
    console.error('Error fetching voices:', e);
  }
}

listVoices();
