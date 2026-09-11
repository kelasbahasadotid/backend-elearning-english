import { server } from '../src/app';

async function main() {
  const PORT = 5111;
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`Test server running on port ${PORT}`);

  try {
    console.log('Testing GET /api/speaking/tts/synthesize...');
    const start = Date.now();
    const res = await fetch(`http://localhost:${PORT}/api/speaking/tts/synthesize?text=Hello%20world%20testing%20speech&voice=en-US-AvaNeural`);
    console.log('Status:', res.status);
    console.log('Headers:', {
      contentType: res.headers.get('content-type'),
      cacheControl: res.headers.get('cache-control'),
      xCache: res.headers.get('x-cache')
    });
    const buffer = await res.arrayBuffer();
    console.log(`Audio received in ${Date.now() - start} ms! Size: ${buffer.byteLength} bytes`);

    // Test 2nd call (should hit cache)
    console.log('\nTesting 2nd call (expecting cache HIT)...');
    const start2 = Date.now();
    const res2 = await fetch(`http://localhost:${PORT}/api/speaking/tts/synthesize?text=Hello%20world%20testing%20speech&voice=en-US-AvaNeural`);
    console.log('Status:', res2.status);
    console.log('X-Cache:', res2.headers.get('x-cache'));
    console.log(`Audio cache HIT in ${Date.now() - start2} ms!`);
  } finally {
    server.close();
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
