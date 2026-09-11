import pool from '../src/config/db';

async function cleanup() {
  await pool.query('DELETE FROM media_files WHERE file_url LIKE "%test_dummy_video_url_123%"');
  await pool.query('DELETE FROM lesson_contents WHERE description LIKE "%test_dummy_video_url_123%"');
  console.log('Cleaned dummy records');
  process.exit(0);
}

cleanup();
