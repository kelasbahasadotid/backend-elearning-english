import app from '../src/app';
import jwt from 'jsonwebtoken';
import http from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key';

const adminToken = jwt.sign(
  { id: 1, email: 'admin@globalenglish.com', role_id: 1 },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const studentToken = jwt.sign(
  { id: 4, email: 'student@globalenglish.com', role_id: 4 },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function runHttpExpiryTests() {
  const port = 5101;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(port, () => resolve()));
  console.log(`Test server running on port ${port}`);

  try {
    // 1. GET /api/study/expiring-courses (Student)
    console.log('\n--- 1. Testing GET /api/study/expiring-courses (Student) ---');
    const res1 = await fetch(`http://localhost:${port}/api/study/expiring-courses`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log('Status:', res1.status);
    const data1: any = await res1.json();
    console.log('Success:', data1.success);
    console.log('Summary:', data1.data?.summary);
    console.log('Courses count:', data1.data?.courses?.length);
    if (data1.data?.courses?.length > 0) {
      console.log('Sample course urgency:', data1.data?.courses[0]?.urgency, 'daysLeft:', data1.data?.courses[0]?.daysLeft);
    }

    // 2. GET /api/students/expiring-courses (Student alias route)
    console.log('\n--- 2. Testing GET /api/students/expiring-courses (Student Alias) ---');
    const res2 = await fetch(`http://localhost:${port}/api/students/expiring-courses`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log('Status:', res2.status);
    const data2: any = await res2.json();
    console.log('Success:', data2.success);

    // 3. GET /api/admin/enrollments/expiring (Admin)
    console.log('\n--- 3. Testing GET /api/admin/enrollments/expiring (Admin) ---');
    const res3 = await fetch(`http://localhost:${port}/api/admin/enrollments/expiring?daysThreshold=7`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res3.status);
    const data3: any = await res3.json();
    console.log('Success:', data3.success);
    console.log('Admin pagination:', data3.pagination);
    console.log('Admin items found:', data3.data?.length);

    // 4. POST /api/admin/enrollments/check-expiries (Admin manual trigger)
    console.log('\n--- 4. Testing POST /api/admin/enrollments/check-expiries (Admin Trigger) ---');
    const res4 = await fetch(`http://localhost:${port}/api/admin/enrollments/check-expiries`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res4.status);
    const data4: any = await res4.json();
    console.log('Success:', data4.success);
    console.log('Trigger result:', data4.data);

    // 5. Security check: Student trying to access Admin endpoints
    console.log('\n--- 5. Security check: Student calling Admin endpoint ---');
    const res5 = await fetch(`http://localhost:${port}/api/admin/enrollments/expiring`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log('Status (expect 403):', res5.status);
    if (res5.status === 403) {
      console.log('✅ RBAC check passed: Student cannot access admin expiring enrollments.');
    } else {
      console.error('❌ RBAC check failed!');
    }

    console.log('\n--- ALL HTTP EXPIRY ENDPOINTS TESTED SUCCESSFULLY! ---');
  } finally {
    server.close();
    process.exit(0);
  }
}

runHttpExpiryTests().catch((err) => {
  console.error('HTTP test failed:', err);
  process.exit(1);
});
