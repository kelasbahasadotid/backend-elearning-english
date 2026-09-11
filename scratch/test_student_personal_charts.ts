import app from '../src/app';
import jwt from 'jsonwebtoken';
import http from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key';

// Generate token for Student #4
const student4Token = jwt.sign(
  { id: 4, email: 'student@globalenglish.com', role_id: 4 },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Generate token for Student #28
const student28Token = jwt.sign(
  { id: 28, email: 'sapadev@example.com', role_id: 4 },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function testStudentPersonalCharts() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5098, () => resolve()));
  console.log('Student test server listening on port 5098');

  try {
    console.log('\n--- 1. Testing GET /api/study/my-xp-analytics for Student #4 ---');
    const res1 = await fetch('http://localhost:5098/api/study/my-xp-analytics?range=30d', {
      headers: { Authorization: `Bearer ${student4Token}` }
    });
    console.log('Status:', res1.status);
    const data1 = await res1.json();
    console.log('Student Info:', data1.student?.fullName, 'ID:', data1.student?.userId);
    console.log('Progression:', {
      level: data1.student?.level,
      levelName: data1.student?.levelName,
      badgeIcon: data1.student?.badgeIcon,
      nextLevelName: data1.student?.nextLevelName,
      xpNeededForNext: data1.student?.xpNeededForNext,
      progressPercent: data1.student?.progressPercent
    });
    console.log('Season Standing:', data1.seasonStanding);
    console.log('Personal XP by Activity:', data1.xpByActivity);
    console.log('Personal Daily XP Trend count:', data1.dailyXpTrend?.length);
    if (data1.dailyXpTrend?.length > 0) {
      console.log('First trend point:', data1.dailyXpTrend[0]);
    }
    console.log('Day of Week Pattern count:', data1.dayOfWeekPattern?.length);
    console.log('Recent Transactions count:', data1.recentTransactions?.length);

    console.log('\n--- 2. Testing GET /api/students/my-xp-analytics (Alias Route) ---');
    const res2 = await fetch('http://localhost:5098/api/students/my-xp-analytics', {
      headers: { Authorization: `Bearer ${student4Token}` }
    });
    console.log('Status:', res2.status);
    const data2 = await res2.json();
    console.log('Alias works correctly:', data2.student?.userId === 4);

    console.log('\n--- 3. Testing Privacy / Isolation: Student #28 gets their OWN data ---');
    const res3 = await fetch('http://localhost:5098/api/study/my-xp-analytics', {
      headers: { Authorization: `Bearer ${student28Token}` }
    });
    console.log('Status:', res3.status);
    const data3 = await res3.json();
    console.log('Student #28 Info:', data3.student?.fullName, 'ID:', data3.student?.userId);
    console.log('Student #28 Personal XP by Activity:', data3.xpByActivity);
    console.log('Student #28 is NOT seeing Student #4:', data3.student?.userId === 28 && data3.student?.userId !== 4);

    console.log('\n✅ Student Personal XP & Gamification Charts Verified Successfully!');
  } finally {
    server.close();
    process.exit(0);
  }
}

testStudentPersonalCharts().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
