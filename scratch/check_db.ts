import pool from '../src/config/db';

async function main() {
  const [tables] = await pool.query("SHOW TABLES LIKE '%question%'");
  console.log('Tables:', tables);

  const [assessmentTables] = await pool.query("SHOW TABLES LIKE '%assessment%'");
  console.log('Assessment Tables:', assessmentTables);

  const [sections] = await pool.query("DESCRIBE assessment_sections");
  console.log('assessment_sections:', sections);

  await pool.end();
}

main().catch(console.error);
