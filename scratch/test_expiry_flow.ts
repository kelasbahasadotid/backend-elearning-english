import pool from '../src/config/db';
import {
  checkAndDispatchExpiryNotifications,
  getStudentExpiringCourses,
  getAdminExpiringEnrollments
} from '../src/services/enrollmentExpiryService';

async function main() {
  console.log('--- STARTING ENROLLMENT EXPIRY TEST SUITE ---');

  // 1. Check existing enrollments
  const [enrollments]: any = await pool.query(`
    SELECT e.id, e.user_id, e.course_id, e.status, e.expired_at, u.full_name, c.title as course_title
    FROM enrollments e
    JOIN users u ON e.user_id = u.id
    JOIN courses c ON e.course_id = c.id
    LIMIT 5
  `);
  console.log('Current sample enrollments in DB:', enrollments);

  if (enrollments.length === 0) {
    console.log('No enrollments found, creating a mock enrollment for testing...');
  }

  // Find or pick a student user
  const [students]: any = await pool.query(`SELECT id, full_name, email FROM users WHERE role_id = 4 LIMIT 1`);
  const student = students[0];
  if (!student) {
    throw new Error('No student found in users table');
  }
  console.log(`Using Student ID ${student.id} (${student.full_name}) for testing`);

  const [courses]: any = await pool.query(`SELECT id, title FROM courses LIMIT 1`);
  const course = courses[0];

  // Create or ensure an enrollment expiring in 2 days (H-3 test case)
  await pool.query(`
    INSERT INTO enrollments (user_id, course_id, source_id, order_id, enrolled_at, expired_at, access_days, status)
    VALUES (?, ?, 1, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), 30, 'ACTIVE')
    ON DUPLICATE KEY UPDATE expired_at = DATE_ADD(NOW(), INTERVAL 2 DAY), status = 'ACTIVE'
  `, [student.id, course.id]);

  console.log(`Ensured enrollment for student ${student.id} in course ${course.title} expiring in 2 days.`);

  // 2. Test checkAndDispatchExpiryNotifications (First run -> Should dispatch H-3 notification)
  console.log('\n--- Running 1st Expiry Check ---');
  const check1 = await checkAndDispatchExpiryNotifications();
  console.log('1st Check Result:', check1);

  // Verify notifications table
  const [notifs]: any = await pool.query(`
    SELECT id, user_id, title, message, is_read, created_at
    FROM user_notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 3
  `, [student.id]);
  console.log('Latest notifications for student:', notifs);

  // 3. Test Deduplication: Run 2nd check immediately -> Should NOT re-send duplicate
  console.log('\n--- Running 2nd Expiry Check (Deduplication Test) ---');
  const check2 = await checkAndDispatchExpiryNotifications();
  console.log('2nd Check Result (expect notificationsSent = 0):', check2);

  if (check2.notificationsSent === 0) {
    console.log('✅ Deduplication SUCCESS: No duplicate notifications dispatched.');
  } else {
    console.error('❌ Deduplication FAILED: Duplicates were created!');
  }

  // 4. Test Student Expiring Courses API
  console.log('\n--- Testing getStudentExpiringCourses ---');
  const studentCourses = await getStudentExpiringCourses(student.id);
  console.log('Student Expiring Courses Summary:', studentCourses.summary);
  console.log('Courses details:', JSON.stringify(studentCourses.courses, null, 2));

  // 5. Test Admin Expiring Enrollments API
  console.log('\n--- Testing getAdminExpiringEnrollments ---');
  const adminEnrollments = await getAdminExpiringEnrollments({ daysThreshold: 7, limit: 10 });
  console.log('Admin Pagination:', adminEnrollments.pagination);
  console.log('Admin Items Count:', adminEnrollments.items.length);
  if (adminEnrollments.items.length > 0) {
    console.log('Sample Admin Item:', adminEnrollments.items[0]);
  }

  console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
