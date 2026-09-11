import pool from '../src/config/db';

async function main() {
  const [courses]: any = await pool.query('SELECT id, title, code, slug FROM courses');
  console.log('Courses in DB:', courses);

  const [lessons]: any = await pool.query('SELECT id, module_id, title FROM lessons ORDER BY id ASC LIMIT 20');
  console.log('Sample lessons in DB:', lessons);

  const [countLessons]: any = await pool.query('SELECT COUNT(*) as total FROM lessons');
  console.log('Total lessons in DB:', countLessons[0].total);

  const [mediaCount]: any = await pool.query('SELECT COUNT(*) as total FROM media_files');
  console.log('Total media_files in DB:', mediaCount[0].total);

  // Check if lesson_id 84, 87, 98, 99 exist
  const [matchingLessons]: any = await pool.query('SELECT id, module_id, title FROM lessons WHERE id IN (84, 87, 98, 99)');
  console.log('Matching lessons in DB for 84, 87, 98, 99:', matchingLessons);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
