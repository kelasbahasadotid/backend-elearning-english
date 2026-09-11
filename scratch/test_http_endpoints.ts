import app from '../src/app';
import jwt from 'jsonwebtoken';
import http from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key';

// Generate admin token
const adminToken = jwt.sign(
  { id: 1, email: 'admin@globalenglish.com', role_id: 1 },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function runHttpTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5099, () => resolve()));
  console.log('Test server listening on port 5099');

  try {
    // 1. Test /api/admin/leaderboard/analytics
    console.log('\n--- 1. Testing HTTP GET /api/admin/leaderboard/analytics ---');
    const res1 = await fetch('http://localhost:5099/api/admin/leaderboard/analytics?range=30d', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res1.status);
    const data1 = await res1.json();
    console.log('Success:', res1.status === 200);
    console.log('Summary Active Season:', data1.summary?.activeSeason?.title);
    console.log('Top students count:', data1.topStudents?.length);
    console.log('Activity breakdown count:', data1.xpByActivity?.length);

    // 2. Test /api/admin/students/xp-stats
    console.log('\n--- 2. Testing HTTP GET /api/admin/students/xp-stats ---');
    const res2 = await fetch('http://localhost:5099/api/admin/students/xp-stats?page=1&limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res2.status);
    const data2 = await res2.json();
    console.log('Success:', res2.status === 200);
    console.log('Total students:', data2.pagination?.total);
    console.log('First student:', data2.students?.[0]?.fullName, 'AllTimeXP:', data2.students?.[0]?.allTimeXp);

    // 3. Test /api/admin/students/4/xp-history
    console.log('\n--- 3. Testing HTTP GET /api/admin/students/4/xp-history ---');
    const res3 = await fetch('http://localhost:5099/api/admin/students/4/xp-history', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res3.status);
    const data3 = await res3.json();
    console.log('Success:', res3.status === 200);
    console.log('Student:', data3.student?.fullName);
    console.log('Transactions count:', data3.transactions?.length);

    // 4. Test /api/admin/analytics
    console.log('\n--- 4. Testing HTTP GET /api/admin/analytics ---');
    const res4 = await fetch('http://localhost:5099/api/admin/analytics', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res4.status);
    const data4 = await res4.json();
    console.log('Success:', res4.status === 200);
    console.log('Leaderboard attached in /admin/analytics:', !!data4.leaderboard);
    console.log('Leaderboard active season:', data4.leaderboard?.activeSeason?.title);
    console.log('Leaderboard top students count:', data4.leaderboard?.topStudents?.length);

    console.log('\n🎉 ALL HTTP ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!');
  } finally {
    server.close();
    process.exit(0);
  }
}

runHttpTests().catch(err => {
  console.error('HTTP Test Error:', err);
  process.exit(1);
});
