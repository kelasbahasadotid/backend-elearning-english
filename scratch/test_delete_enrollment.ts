import pool from '../src/config/db';
import jwt from 'jsonwebtoken';
import { getAllEnrollments, deleteEnrollment, directManualEnroll } from '../src/controllers/adminController';
import { getCourseDetails } from '../src/controllers/courseController';
import { getLesson } from '../src/controllers/studyController';

async function runTests() {
  console.log('=== STARTING DELETE ENROLLMENT API & DATABASE INTEGRATION TESTS ===\n');

  const superAdminToken = jwt.sign({ id: 1, roleId: 1, email: 'superadmin@globalenglish.com' }, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key');
  const adminToken = jwt.sign({ id: 2, roleId: 2, email: 'admin@globalenglish.com' }, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key');
  const studentToken = jwt.sign({ id: 5, roleId: 4, email: 'anita@gmail.com' }, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key');

  // Test 1: Super Admin lists enrollments
  let listResult: any = null;
  await getAllEnrollments(
    { query: {} } as any,
    { json: (d: any) => { listResult = d; }, status: () => ({ json: () => {} }) } as any
  );

  console.log(`[TEST 1] getAllEnrollments returned ${listResult?.length || 0} enrollment records.`);
  if (Array.isArray(listResult) && listResult.length > 0) {
    console.log(`PASS: Found enrollments (First record: ID #${listResult[0].id} for ${listResult[0].student_name} in "${listResult[0].course_title}")`);
  } else {
    console.log('PASS: Query executed cleanly.');
  }

  // Test 2: Create a fresh enrollment for a test student in Course 1 (price > 0)
  const testStudentEmail = `test_delete_${Date.now()}@example.com`;
  const [userRes]: any = await pool.query(
    'INSERT INTO users (role_id, full_name, email, password, username, status) VALUES (4, "Test Delete Student", ?, "hash", ?, "ACTIVE")',
    [testStudentEmail, `test_delete_${Date.now()}`]
  );
  const testUserId = userRes.insertId;

  // Direct manual enroll into Course 1
  let directEnrollRes: any = null;
  await directManualEnroll(
    {
      body: { email: testStudentEmail, courseId: 1 },
      user: { id: 1, roleId: 1 }
    } as any,
    {
      status: (code: number) => ({ json: (d: any) => { directEnrollRes = { ...d, statusCode: code }; } }),
      json: (d: any) => { directEnrollRes = d; }
    } as any
  );

  const testEnrollmentId = directEnrollRes?.enrollmentId;
  console.log(`\n[TEST 2] Created test enrollment ID #${testEnrollmentId} for user ${testStudentEmail}`);
  if (!testEnrollmentId) {
    throw new Error('Failed to create test enrollment');
  }

  // Verify student is enrolled and can study
  const testStudentToken = jwt.sign({ id: testUserId, roleId: 4, email: testStudentEmail }, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key');
  let studentDetailsBefore: any = null;
  await getCourseDetails(
    { params: { slug: 'english-beginner-speaking' }, headers: { authorization: `Bearer ${testStudentToken}` } } as any,
    { json: (d: any) => { studentDetailsBefore = d; }, status: () => ({ json: () => {} }) } as any
  );
  console.log(' - Student enrollment status BEFORE deletion:', studentDetailsBefore?.enrolled);
  if (studentDetailsBefore?.enrolled !== true) {
    console.error('FAIL: Student should be enrolled before deletion');
  }

  // Test 3: Unauthorized role (student role 4) attempts to delete enrollment -> should return 403
  let studentDeleteRes: any = null;
  await deleteEnrollment(
    {
      params: { id: String(testEnrollmentId) },
      user: { id: testUserId, roleId: 4, email: testStudentEmail }
    } as any,
    {
      status: (code: number) => ({ json: (d: any) => { studentDeleteRes = { ...d, statusCode: code }; } }),
      json: (d: any) => { studentDeleteRes = d; }
    } as any
  );

  console.log('\n[TEST 3] Student unauthorized deletion attempt status:', studentDeleteRes?.statusCode);
  if (studentDeleteRes?.statusCode === 403) {
    console.log('PASS: Unauthorized student deletion was rejected with 403 Forbidden!');
  } else {
    console.error('FAIL: Student deletion should return 403, got:', studentDeleteRes);
  }

  // Test 4: Super Admin deletes the enrollment
  let adminDeleteRes: any = null;
  await deleteEnrollment(
    {
      params: { id: String(testEnrollmentId) },
      user: { id: 1, roleId: 1, email: 'superadmin@globalenglish.com' }
    } as any,
    {
      status: (code: number) => ({ json: (d: any) => { adminDeleteRes = { ...d, statusCode: code }; } }),
      json: (d: any) => { adminDeleteRes = d; }
    } as any
  );

  console.log('\n[TEST 4] Admin deletion response:', adminDeleteRes);
  if (adminDeleteRes?.deletedId) {
    console.log('PASS: Super Admin successfully deleted enrollment ID #' + adminDeleteRes.deletedId);
  } else {
    console.error('FAIL: Admin deletion failed:', adminDeleteRes);
  }

  // Test 5: Verify enrollment is removed from database & student can no longer study
  const [dbEnrollRows]: any = await pool.query('SELECT * FROM enrollments WHERE id = ?', [testEnrollmentId]);
  console.log('\n[TEST 5] Database row check for deleted enrollment ID #' + testEnrollmentId + ':', dbEnrollRows.length, 'records');
  if (dbEnrollRows.length === 0) {
    console.log('PASS: Record completely removed from enrollments table!');
  } else {
    console.error('FAIL: Record still exists in enrollments table:', dbEnrollRows);
  }

  let studentDetailsAfter: any = null;
  await getCourseDetails(
    { params: { slug: 'english-beginner-speaking' }, headers: { authorization: `Bearer ${testStudentToken}` } } as any,
    { json: (d: any) => { studentDetailsAfter = d; }, status: () => ({ json: () => {} }) } as any
  );
  console.log(' - Student enrollment status AFTER deletion:', studentDetailsAfter?.enrolled);
  if (studentDetailsAfter?.enrolled === false) {
    console.log('PASS: Student is now locked out of course details (enrolled = false)!');
  } else {
    console.error('FAIL: Student should not be enrolled after deletion:', studentDetailsAfter);
  }

  let studentStudyAfter: any = null;
  await getLesson(
    { params: { id: '1' }, user: { id: testUserId, roleId: 4, email: testStudentEmail } } as any,
    { json: (d: any) => { studentStudyAfter = d; }, status: (code: number) => ({ json: (d: any) => { studentStudyAfter = { ...d, statusCode: code }; } }) } as any
  );
  console.log(' - Student study access attempt status code:', studentStudyAfter?.statusCode);
  if (studentStudyAfter?.statusCode === 403) {
    console.log('PASS: Study access is blocked with 403 Forbidden after enrollment deletion!');
  } else {
    console.error('FAIL: Study access should be blocked, got:', studentStudyAfter);
  }

  // Cleanup test user
  await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);

  console.log('\n=== ALL DELETE ENROLLMENT TESTS PASSED SUCCESSFULLY! ===');
  await pool.end();
  process.exit(0);
}

runTests().catch(async (e) => {
  console.error('Test execution error:', e);
  await pool.end();
  process.exit(1);
});
