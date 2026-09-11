import pool from '../src/config/db';

async function test() {
  const [cols]: any = await pool.query('SHOW COLUMNS FROM user_notifications');
  console.log('user_notifications cols:', cols.map((c: any) => ({ field: c.Field, type: c.Type })));

  const [sample]: any = await pool.query('SELECT * FROM user_notifications ORDER BY id DESC LIMIT 5');
  console.log('sample user_notifications:', sample);

  const [enrollments]: any = await pool.query(`
    SELECT e.id, e.user_id, e.course_id, e.enrolled_at, e.expired_at, e.status, c.title as course_title, u.full_name, u.email,
           DATEDIFF(e.expired_at, NOW()) as days_left
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON e.user_id = u.id
    LIMIT 10
  `);
  console.log('sample enrollments with expiry:', enrollments);

  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
