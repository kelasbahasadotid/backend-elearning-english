const mysql = require('./node_modules/mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'elearning_language'
  });

  try {
    console.log('Altering background_image column to LONGTEXT...');
    await connection.query('ALTER TABLE certificate_templates MODIFY COLUMN background_image LONGTEXT NULL');
    console.log('ALTER TABLE SUCCESSFUL!');

    const [rows] = await connection.query('DESCRIBE certificate_templates');
    console.log('Current schema:');
    console.log(rows);
  } catch (err) {
    console.error('FAILED:', err);
  } finally {
    await connection.destroy();
  }
}

run();
