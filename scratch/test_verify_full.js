const mysql = require('mysql2/promise');
require('dotenv').config();

async function testFull() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'elearning_language'
  });

  const code = 'V-1787009446567-289316';

  try {
    const [certs] = await connection.query(
      `SELECT c.id, c.user_id, c.issued_at, c.verification_code, cn.certificate_number, 
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
       WHERE (c.verification_code = ? OR cn.certificate_number = ? OR c.verification_code LIKE ? OR cn.certificate_number LIKE ?) 
         AND (c.status IS NULL OR c.status = '' OR UPPER(c.status) IN ('ACTIVE', 'ISSUED', 'PUBLISHED', '1')) LIMIT 1`,
      [code, code, `%${code}%`, `%${code}%`]
    );

    const cert = certs[0];
    console.log('Cert found:', cert);

    const [quizAttempts] = await connection.query(
      `SELECT a.title, MAX(ap.highest_score) as bestScore, MAX(ap.passed) as passed
       FROM assessments a
       LEFT JOIN assessment_progress ap ON ap.assessment_id = a.id AND ap.user_id = ?
       WHERE a.course_id = ?
       GROUP BY a.id, a.title`,
      [cert.user_id, cert.courseId]
    );
    console.log('Quiz attempts result:', quizAttempts);

    const [speakingAttempts] = await connection.query(
      `SELECT st.title, MAX(sa.overall_score) as bestScore
       FROM speaking_tests st
       JOIN assessments a ON st.assessment_id = a.id
       LEFT JOIN speaking_attempts sa ON sa.speaking_test_id = st.id AND sa.user_id = ?
       WHERE a.course_id = ?
       GROUP BY st.id, st.title`,
      [cert.user_id, cert.courseId]
    );
    console.log('Speaking attempts result:', speakingAttempts);

    const payload = {
      valid: true,
      certificateNumber: cert.certificate_number,
      verificationCode: cert.verification_code,
      issuedAt: cert.issued_at,
      studentName: cert.studentName,
      studentEmail: cert.studentEmail,
      courseTitle: cert.courseTitle,
      cefrLevel: cert.cefr_level,
      backgroundImage: cert.background_image || 'uploads/certificates/gold_border.png',
      orientation: cert.orientation || 'LANDSCAPE',
      paperSize: cert.paper_size || 'A4',
      quizGrades: quizAttempts,
      speakingGrades: speakingAttempts
    };
    console.log('SUCCESS PAYLOAD:', JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('FATAL SQL ERROR:', err);
  }

  await connection.end();
}

testFull();
