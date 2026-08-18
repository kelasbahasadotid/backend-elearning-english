async function verifyAllVoices() {
  const { Communicate } = require('edge-tts-universal');
  const testVoices = [
    // UK
    { id: 'en-GB-SoniaNeural', name: 'Sonia' },
    { id: 'en-GB-RyanNeural', name: 'Ryan / James' },
    { id: 'en-GB-LibbyNeural', name: 'Libby' },
    { id: 'en-GB-MaisieNeural', name: 'Maisie' },
    { id: 'en-GB-ThomasNeural', name: 'Thomas' },
    { id: 'en-GB-OliverNeural', name: 'Oliver' },
    // US
    { id: 'en-US-AvaNeural', name: 'Ava / Olivia' },
    { id: 'en-US-AndrewNeural', name: 'Andrew' },
    { id: 'en-US-EmmaNeural', name: 'Emma' },
    { id: 'en-US-BrianNeural', name: 'Brian' },
    { id: 'en-US-AnaNeural', name: 'Ana' },
    { id: 'en-US-GuyNeural', name: 'Guy' },
    { id: 'en-US-AriaNeural', name: 'Aria' },
    { id: 'en-US-JennyNeural', name: 'Jenny' },
    { id: 'en-US-ChristopherNeural', name: 'Christopher' },
    { id: 'en-US-EricNeural', name: 'Eric' },
    { id: 'en-US-MichelleNeural', name: 'Michelle' },
    { id: 'en-US-RogerNeural', name: 'Roger' },
    { id: 'en-US-SteffanNeural', name: 'Steffan' },
    // Regional
    { id: 'en-AU-NatashaNeural', name: 'Natasha' },
    { id: 'en-AU-WilliamNeural', name: 'William' },
    { id: 'en-CA-ClaraNeural', name: 'Clara' },
    { id: 'en-CA-LiamNeural', name: 'Liam' },
    { id: 'en-IN-NeerjaNeural', name: 'Neerja' },
    { id: 'en-IN-PrabhatNeural', name: 'Prabhat' },
    { id: 'en-IE-EmilyNeural', name: 'Emily' },
    { id: 'en-IE-ConnorNeural', name: 'Connor' },
    { id: 'en-NZ-MitchellNeural', name: 'Mitchell' },
  ];

  const results: any[] = [];
  for (const v of testVoices) {
    try {
      const comm = new Communicate('Hello', { voice: v.id });
      const chunks: Buffer[] = [];
      for await (const chunk of comm.stream()) {
        if (chunk.type === 'audio') chunks.push(chunk.data);
      }
      const buf = Buffer.concat(chunks);
      results.push({ id: v.id, name: v.name, status: buf.length > 0 ? 'OK' : 'EMPTY', bytes: buf.length });
    } catch (e: any) {
      results.push({ id: v.id, name: v.name, status: 'ERROR: ' + (e.message || e) });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}
verifyAllVoices();
