import pool from '../config/db';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Adding attachments column to lesson_contents...');
    await conn.query(`
      ALTER TABLE lesson_contents 
      ADD COLUMN IF NOT EXISTS attachments LONGTEXT NULL COMMENT 'JSON array of base64-encoded file attachments: [{name,type,mime,data}]'
    `).catch(() => console.log('attachments column already exists or error, trying update...'));

    // If IF NOT EXISTS not supported (older MySQL), try without
    try {
      await conn.query(`
        ALTER TABLE lesson_contents ADD COLUMN attachments LONGTEXT NULL
        COMMENT 'JSON array of base64-encoded file attachments: [{name,type,mime,data}]'
      `);
    } catch (_) { /* already exists */ }

    console.log('Adding question_image column to questions...');
    try {
      await conn.query(`
        ALTER TABLE questions ADD COLUMN question_image MEDIUMTEXT NULL
        COMMENT 'Optional base64-encoded image for question context'
      `);
    } catch (_) { console.log('question_image already exists'); }

    console.log('Adding option_image column to question_options...');
    try {
      await conn.query(`
        ALTER TABLE question_options ADD COLUMN option_image MEDIUMTEXT NULL
        COMMENT 'Optional base64-encoded image for answer option'
      `);
    } catch (_) { console.log('option_image already exists'); }

    // Verify
    const [cols1] = await conn.query('SHOW COLUMNS FROM lesson_contents') as any;
    const [cols2] = await conn.query('SHOW COLUMNS FROM questions') as any;
    const [cols3] = await conn.query('SHOW COLUMNS FROM question_options') as any;

    console.log('lesson_contents cols:', cols1.map((c:any) => c.Field).join(', '));
    console.log('questions cols:', cols2.map((c:any) => c.Field).join(', '));
    console.log('question_options cols:', cols3.map((c:any) => c.Field).join(', '));
    console.log('Migration completed successfully!');
  } catch (e: any) {
    console.error('Migration error:', e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
