import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export const claimCertificate = async (req: AuthRequest, res: Response) => {
  const { courseId } = req.body;
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  if (!courseId) {
     res.status(400).json({ error: 'courseId is required' });
     return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch enrollment
    const [enrollments] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'ACTIVE' LIMIT 1",
      [req.user.id, courseId]
    );

    if (enrollments.length === 0) {
       res.status(403).json({ error: 'Anda belum terdaftar / ter-enroll pada kursus ini.' });
       connection.release();
       return;
    }
    const enrollmentId = enrollments[0].id;

    // 2. Fetch course progress to verify if 100% completion requirement is met
    const [progress] = await connection.query<RowDataPacket[]>(
      'SELECT overall_progress, certificate_ready FROM course_progress WHERE user_id = ? AND course_id = ? LIMIT 1',
      [req.user.id, courseId]
    );

    const overallProgress = progress.length > 0 ? Number(progress[0].overall_progress || 0) : 0;
    const certReady = progress.length > 0 ? Number(progress[0].certificate_ready || 0) : 0;

    if (overallProgress < 100 && certReady !== 1) {
       res.status(400).json({
         error: `Sertifikat dan QR Code resmi hanya dapat dibuka ketika Anda telah menyelesaikan 100% materi kursus. (Progress Anda saat ini: ${Math.round(overallProgress)}%)`
       });
       connection.release();
       return;
    }

    // 3. Check if certificate is already issued
    const [existingCert] = await connection.query<RowDataPacket[]>(
      `SELECT c.id, c.issued_at, c.verification_code, cn.certificate_number,
              COALESCE(ct_course.background_image, ct.background_image) as background_image,
              COALESCE(ct_course.orientation, ct.orientation, 'LANDSCAPE') as orientation,
              COALESCE(ct_course.paper_size, ct.paper_size, 'A4') as paper_size,
              COALESCE(ct_course.template_name, ct.template_name) as template_name 
       FROM certificates c 
       JOIN certificate_numbers cn ON c.certificate_number_id = cn.id 
       LEFT JOIN certificate_templates ct ON c.template_id = ct.id
       LEFT JOIN certificate_templates ct_course ON ct_course.course_id = c.course_id AND ct_course.active = 1
       WHERE c.user_id = ? AND c.course_id = ? AND c.status = 'ACTIVE'`,
      [req.user.id, courseId]
    );

    if (existingCert.length > 0) {
      res.json({
        message: 'Certificate already issued',
        certificate: {
          certificateNumber: existingCert[0].certificate_number,
          verificationCode: existingCert[0].verification_code,
          issuedAt: existingCert[0].issued_at,
          backgroundImage: existingCert[0].background_image,
          orientation: existingCert[0].orientation || 'LANDSCAPE',
          paperSize: existingCert[0].paper_size || 'A4',
          templateName: existingCert[0].template_name
        }
      });
      connection.release();
      return;
    }

    // 4. Generate running certificate number
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed

    const [latestNumber] = await connection.query<RowDataPacket[]>(
      'SELECT MAX(running_number) as max_num FROM certificate_numbers WHERE year = ? AND month = ?',
      [year, month]
    );

    const nextNum = (latestNumber[0].max_num || 0) + 1;
    const paddedNum = String(nextNum).padStart(6, '0');
    const certNumStr = `CERT/LMS/${year}/${String(month).padStart(2, '0')}/${paddedNum}`;

    // Insert certificate number record
    const [certNumberResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO certificate_numbers (certificate_number, running_number, year, month) VALUES (?, ?, ?, ?)',
      [certNumStr, nextNum, year, month]
    );
    const certNumberId = certNumberResult.insertId;

    // Generate unique verification code
    const verificationCode = `V-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Dynamically retrieve the certificate template bound to this course
    const [templates] = await connection.query<RowDataPacket[]>(
      "SELECT id, background_image, orientation, paper_size, template_name FROM certificate_templates WHERE course_id = ? AND active = 1 LIMIT 1",
      [courseId]
    );

    let selectedTemplate: any = null;
    let templateId = 1;

    if (templates.length > 0) {
      selectedTemplate = templates[0];
      templateId = templates[0].id;
    } else {
      const [defaultTemplates] = await connection.query<RowDataPacket[]>(
        "SELECT id, background_image, orientation, paper_size, template_name FROM certificate_templates WHERE active = 1 ORDER BY id ASC LIMIT 1"
      );
      if (defaultTemplates.length > 0) {
        selectedTemplate = defaultTemplates[0];
        templateId = defaultTemplates[0].id;
      }
    }

    // Create certificate record
    const pdfPath = `uploads/certificates/cert-${verificationCode}.pdf`;
    const qrCodePath = `uploads/certificates/qr-${verificationCode}.png`;
    
    await connection.query(
      `INSERT INTO certificates 
       (certificate_number_id, user_id, course_id, enrollment_id, template_id, issued_at, verification_code, pdf_path, qr_code_path, status) 
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, 'ACTIVE')`,
      [certNumberId, req.user.id, courseId, enrollmentId, templateId, verificationCode, pdfPath, qrCodePath]
    );

    await connection.commit();
    res.status(201).json({
      message: 'Certificate claimed successfully',
      certificate: {
        certificateNumber: certNumStr,
        verificationCode,
        issuedAt: now,
        pdfPath,
        backgroundImage: selectedTemplate?.background_image || null,
        orientation: selectedTemplate?.orientation || 'LANDSCAPE',
        paperSize: selectedTemplate?.paper_size || 'A4',
        templateName: selectedTemplate?.template_name
      }
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(502).json({ error: error.message || 'Internal server error' });
  } finally {
    connection.release();
  }
};

export const verifyCertificate = async (req: any, res: Response) => {
  const { code } = req.params;
  try {
    const [certs] = await pool.query<RowDataPacket[]>(
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
       WHERE c.verification_code = ? AND c.status = 'ACTIVE' LIMIT 1`,
      [code]
    );

    if (certs.length === 0) {
      res.status(404).json({ error: 'Certificate not found or invalid code' });
      return;
    }

    const cert = certs[0];

    const [quizAttempts] = await pool.query<RowDataPacket[]>(
      `SELECT a.title, MAX(ap.highest_score) as bestScore, MAX(ap.completed) as passed
       FROM assessments a
       LEFT JOIN assessment_progress ap ON ap.assessment_id = a.id AND ap.user_id = ?
       WHERE a.course_id = ?
       GROUP BY a.id`,
      [cert.user_id, cert.courseId]
    );

    const [speakingAttempts] = await pool.query<RowDataPacket[]>(
      `SELECT st.title, MAX(sa.overall_score) as bestScore
       FROM speaking_tests st
       LEFT JOIN speaking_attempts sa ON sa.speaking_test_id = st.id AND sa.user_id = ?
       WHERE st.course_id = ?
       GROUP BY st.id`,
      [cert.user_id, cert.courseId]
    );

    res.json({
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
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
