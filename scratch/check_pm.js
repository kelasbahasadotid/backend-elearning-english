const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPM() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'elearning_language'
  });

  const [methods] = await connection.query('SELECT * FROM payment_methods');
  console.log('Payment Methods:', methods);
  
  const [sources] = await connection.query('SELECT * FROM enrollment_sources');
  console.log('Enrollment Sources:', sources);

  await connection.end();
}

checkPM();
