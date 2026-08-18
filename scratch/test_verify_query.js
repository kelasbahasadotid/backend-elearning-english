const mysql = require('mysql2/promise');
require('dotenv').config();

async function testVerify() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'elearning_language'
  });

  const code = 'V-1787009446567-289316';
  const sql = `SELECT c.id, c.user_id, c.issued_at, c.verification_code, cn.certificate_number, 
          u.full_name as studentName, u.email as studentEmail,
          crs.title as courseTitle, crs.id as courseId, crs.cefr_level,
          COALESCE(ct_course.background_image, ct.background_image) as background_image,
          COALESCE(ct_course.orientation, ct.orientation, 'LANDSCAPE') as orientation,
          COALESCE(ct_course.paper_size, ct.paper_size, 'A4') as paper_size
   FROM certificates c 
   JOIN certificate_numbers cn ON c.certificate_number_id = cn.id
   JOIN users u ON c.user_id = u.id
   JOIN courses crs ON c.course_id = crs.id
   LEFT JOIN certificate_templates ct ON c.template_id = ct.id
   LEFT JOIN certificate_templates ct_course ON ct_course.course_id = crs.id AND ct_course.active = 1
   WHERE (c.verification_code = ? OR cn.certificate_number = ?) AND c.status = 'ACTIVE' LIMIT 1`;
  const [certs] = await connection.query(sql, [code, code]);
  console.log('Query result:', JSON.stringify(certs, null, 2));

  await connection.end();
}

testVerify();
