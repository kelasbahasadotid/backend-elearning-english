const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'elearning_language'
  });
  try {
    const [rows] = await pool.query("DESCRIBE user_notifications");
    console.log('user_notifications schema:', rows);
  } catch (err) {
    console.error('Error checking table:', err.message);
  } finally {
    await pool.end();
  }
})();
