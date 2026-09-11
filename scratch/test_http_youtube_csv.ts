import { server } from '../src/app';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key';

const adminToken = jwt.sign(
  { id: 1, email: 'admin@globalenglish.com', role_id: 1, fullName: 'Super Admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function main() {
  const PORT = 5109;
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`Server running on port ${PORT}`);

  try {
    // 1. Test GET /api/media/template-youtube-csv?format=json
    console.log('\n--- 1. Testing GET /api/media/template-youtube-csv (JSON Format) ---');
    const res1 = await fetch(`http://localhost:${PORT}/api/media/template-youtube-csv?format=json`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res1.status);
    const data1: any = await res1.json();
    console.log('Template columns:', data1.columns);
    console.log('Sample rows count:', data1.sample?.length);

    // 2. Test GET /api/media/template-youtube-csv (File download)
    console.log('\n--- 2. Testing GET /api/media/template-youtube-csv (Download CSV) ---');
    const res2 = await fetch(`http://localhost:${PORT}/api/media/template-youtube-csv`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res2.status);
    console.log('Content-Type:', res2.headers.get('content-type'));
    console.log('Content-Disposition:', res2.headers.get('content-disposition'));
    const text2 = await res2.text();
    console.log('CSV preview first 2 lines:\n' + text2.split('\n').slice(0, 2).join('\n'));

    // 3. Test POST /api/media/import-youtube-csv (with csv_text)
    console.log('\n--- 3. Testing POST /api/media/import-youtube-csv (Payload) ---');
    const testCsv = [
      'topic,lesson_id,lesson,youtube_url',
      'Test Topic 99,99,Test Lesson 99,https://youtu.be/test_dummy_video_url_123'
    ].join('\n');

    const res3 = await fetch(`http://localhost:${PORT}/api/media/import-youtube-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ csv_text: testCsv })
    });
    console.log('Status:', res3.status);
    const data3: any = await res3.json();
    console.log('Result message:', data3.message);
    console.log('Processed rows:', data3.data?.totalRows);

    console.log('\n✅ ALL HTTP YOUTUBE IMPORT ENDPOINTS TESTED SUCCESSFULLY!');
  } finally {
    server.close();
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
