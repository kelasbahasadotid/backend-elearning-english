// Voice Normalizer Map that maps legacy/frontend alias names to verified working official Edge-TTS Neural Voices
export const VOICE_ALIAS_MAP: Record<string, string> = {
  // US English Voices
  'en-US-AvaNeural': 'en-US-AvaNeural',
  'en-US-AvaMultilingualNeural': 'en-US-AvaMultilingualNeural',
  'en-US-AndrewNeural': 'en-US-AndrewMultilingualNeural',
  'en-US-AndrewMultilingualNeural': 'en-US-AndrewMultilingualNeural',
  'en-US-EmmaNeural': 'en-US-EmmaMultilingualNeural',
  'en-US-EmmaMultilingualNeural': 'en-US-EmmaMultilingualNeural',
  'en-US-BrianNeural': 'en-US-BrianMultilingualNeural',
  'en-US-BrianMultilingualNeural': 'en-US-BrianMultilingualNeural',
  'en-US-AnaNeural': 'en-US-AnaNeural',
  'en-US-GuyNeural': 'en-US-GuyNeural',
  'en-US-AriaNeural': 'en-US-AriaNeural',
  'en-US-JennyNeural': 'en-US-JennyNeural',
  'en-US-ChristopherNeural': 'en-US-ChristopherNeural',
  'en-US-EricNeural': 'en-US-EricNeural',
  'en-US-MichelleNeural': 'en-US-MichelleNeural',
  'en-US-RogerNeural': 'en-US-RogerNeural',
  'en-US-SteffanNeural': 'en-US-SteffanNeural',

  // UK British English Voices
  'en-GB-SoniaNeural': 'en-GB-SoniaNeural',
  'en-GB-RyanNeural': 'en-GB-RyanNeural',
  'en-GB-LibbyNeural': 'en-GB-LibbyNeural',
  'en-GB-MaisieNeural': 'en-GB-MaisieNeural',
  'en-GB-ThomasNeural': 'en-GB-ThomasNeural',
  'en-GB-OliverNeural': 'en-GB-ThomasNeural', // Maps to Thomas (valid UK Male)

  // AU Australian English Voices
  'en-AU-NatashaNeural': 'en-AU-NatashaNeural',
  'en-AU-WilliamNeural': 'en-AU-WilliamNeural',

  // CA Canadian English Voices
  'en-CA-ClaraNeural': 'en-CA-ClaraNeural',
  'en-CA-LiamNeural': 'en-CA-LiamNeural',

  // IN Indian English Voices
  'en-IN-NeerjaNeural': 'en-IN-NeerjaNeural',
  'en-IN-PrabhatNeural': 'en-IN-PrabhatNeural',

  // Indonesian Voices
  'id-ID-GadisNeural': 'id-ID-GadisNeural',
  'id-ID-ArdiNeural': 'id-ID-ArdiNeural',

  // Generic Frontend Fallbacks
  'US_FEMALE': 'en-US-AvaNeural',
  'US_MALE': 'en-US-BrianMultilingualNeural',
  'UK_FEMALE': 'en-GB-SoniaNeural',
  'UK_MALE': 'en-GB-RyanNeural',
  'AU_FEMALE': 'en-AU-NatashaNeural',
  'AU_MALE': 'en-AU-WilliamNeural',
  'CA_FEMALE': 'en-CA-ClaraNeural',
  'CA_MALE': 'en-CA-LiamNeural',
  'IN_FEMALE': 'en-IN-NeerjaNeural',
  'ID_FEMALE': 'id-ID-GadisNeural',
  'ID_MALE': 'id-ID-ArdiNeural'
};

export const CURATED_VOICES = [
  // UK
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female - British Accent)', gender: 'Female', locale: 'en-GB', accent: 'British' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male - British Accent)', gender: 'Male', locale: 'en-GB', accent: 'British' },
  { id: 'en-GB-LibbyNeural', name: 'Libby (UK Female - Soft British)', gender: 'Female', locale: 'en-GB', accent: 'British' },
  { id: 'en-GB-MaisieNeural', name: 'Maisie (UK Young Female)', gender: 'Female', locale: 'en-GB', accent: 'British' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas (UK Male - Clear British)', gender: 'Male', locale: 'en-GB', accent: 'British' },
  { id: 'en-GB-OliverNeural', name: 'Oliver (UK Male - Formal British)', gender: 'Male', locale: 'en-GB', accent: 'British' },

  // US
  { id: 'en-US-AvaNeural', name: 'Ava (US Female - Natural & Friendly)', gender: 'Female', locale: 'en-US', accent: 'American' },
  { id: 'en-US-AndrewNeural', name: 'Andrew (US Male - Professional)', gender: 'Male', locale: 'en-US', accent: 'American' },
  { id: 'en-US-EmmaNeural', name: 'Emma (US Female - Warm Conversational)', gender: 'Female', locale: 'en-US', accent: 'American' },
  { id: 'en-US-BrianNeural', name: 'Brian (US Male - Deep Clear Voice)', gender: 'Male', locale: 'en-US', accent: 'American' },
  { id: 'en-US-AnaNeural', name: 'Ana (US Young Female - Expressive)', gender: 'Female', locale: 'en-US', accent: 'American' },
  { id: 'en-US-GuyNeural', name: 'Guy (US Male - Casual)', gender: 'Male', locale: 'en-US', accent: 'American' },
  { id: 'en-US-AriaNeural', name: 'Aria (US Female - News & Formal)', gender: 'Female', locale: 'en-US', accent: 'American' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US Female - Assistant)', gender: 'Female', locale: 'en-US', accent: 'American' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher (US Male - Storyteller)', gender: 'Male', locale: 'en-US', accent: 'American' },
  { id: 'en-US-EricNeural', name: 'Eric (US Male - Energetic)', gender: 'Male', locale: 'en-US', accent: 'American' },
  { id: 'en-US-MichelleNeural', name: 'Michelle (US Female - Friendly)', gender: 'Female', locale: 'en-US', accent: 'American' },
  { id: 'en-US-RogerNeural', name: 'Roger (US Male - Formal)', gender: 'Male', locale: 'en-US', accent: 'American' },
  { id: 'en-US-SteffanNeural', name: 'Steffan (US Male - Energetic)', gender: 'Male', locale: 'en-US', accent: 'American' },

  // AU
  { id: 'en-AU-NatashaNeural', name: 'Natasha (AU Female - Australian Accent)', gender: 'Female', locale: 'en-AU', accent: 'Australian' },
  { id: 'en-AU-WilliamNeural', name: 'William (AU Male - Australian Accent)', gender: 'Male', locale: 'en-AU', accent: 'Australian' },

  // CA
  { id: 'en-CA-ClaraNeural', name: 'Clara (CA Female - Canadian Accent)', gender: 'Female', locale: 'en-CA', accent: 'Canadian' },
  { id: 'en-CA-LiamNeural', name: 'Liam (CA Male - Canadian Accent)', gender: 'Male', locale: 'en-CA', accent: 'Canadian' },

  // IN
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (IN Female - Indian Accent)', gender: 'Female', locale: 'en-IN', accent: 'Indian' },

  // ID
  { id: 'id-ID-GadisNeural', name: 'Gadis (Indonesian Female)', gender: 'Female', locale: 'id-ID', accent: 'Indonesian' },
  { id: 'id-ID-ArdiNeural', name: 'Ardi (Indonesian Male)', gender: 'Male', locale: 'id-ID', accent: 'Indonesian' }
];

export function resolveVoice(voiceName?: string): string {
  if (!voiceName) return 'en-US-AvaNeural';
  const clean = voiceName.trim();
  if (VOICE_ALIAS_MAP[clean]) {
    return VOICE_ALIAS_MAP[clean];
  }
  const found = Object.keys(VOICE_ALIAS_MAP).find(k => k.toLowerCase() === clean.toLowerCase());
  if (found) return VOICE_ALIAS_MAP[found];
  return clean;
}
