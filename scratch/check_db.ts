import pool from '../src/config/db';

async function run() {
  try {
    const [media]: any = await pool.query('SELECT id, title, file_type, source_type, usage_count, file_url FROM media_files WHERE deleted_at IS NULL ORDER BY id LIMIT 30');
    console.log('\n=== MEDIA FILES ===');
    console.log(JSON.stringify(media, null, 2));

    const [courses]: any = await pool.query(`
      SELECT c.id as course_id, c.title as course_title, l.id as lesson_id, l.title as lesson_title, l.lesson_type
      FROM courses c
      JOIN course_versions cv ON cv.course_id = c.id
      JOIN modules m ON m.course_version_id = cv.id
      JOIN lessons l ON l.module_id = m.id
      WHERE l.lesson_type IN ('READING','VIDEO')
      ORDER BY c.id, l.id
    `);
    console.log('\n=== READING/VIDEO LESSONS ===');
    console.log(JSON.stringify(courses, null, 2));
  } catch(e: any) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
