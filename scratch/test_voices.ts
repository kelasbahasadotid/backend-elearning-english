import pool from '../src/config/db';

async function test() {
  try {
    const [lessonTypes] = await pool.query('SELECT DISTINCT lesson_type FROM lessons');
    console.log('Distinct lesson_types in DB:', lessonTypes);
    
    const [lessons] = await pool.query(`
      SELECT l.id as lesson_id, l.title as lesson_title, l.lesson_type, m.id as module_id, m.title as module_title, c.id as course_id, c.title as course_title
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      JOIN courses c ON m.course_id = c.id
      ORDER BY c.title, m.module_order, l.lesson_order
    `);
    console.log('Total lessons in DB:', lessons.length);
    console.log('Sample all lessons:', lessons.slice(0, 10));

    // Test edge-tts-universal
    const { Communicate, getVoices } = require('edge-tts-universal');
    if (getVoices) {
      const voices = await getVoices();
      console.log('Total voices in edge-tts-universal:', voices.length);
      const enVoices = voices.filter((v: any) => v.Locale?.startsWith('en-') || v.ShortName?.startsWith('en-'));
      console.log('English voices sample:', enVoices.slice(0, 15));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
