import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { addXpTransaction } from '../utils/xp';
import { updateProgressHelper, checkSequentialLessonLock } from '../utils/progress';

export const getQuiz = async (req: AuthRequest, res: Response) => {
  const { id } = req.params; // Assessment ID
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    // 1. Fetch assessment details
    const [assessments] = await pool.query<RowDataPacket[]>(
      `SELECT a.*, l.max_attempt 
       FROM assessments a 
       LEFT JOIN lessons l ON a.lesson_id = l.id 
       WHERE a.id = ? AND a.status = "PUBLISHED"`,
      [id]
    );

    if (assessments.length === 0) {
       res.status(404).json({ error: 'Quiz not found' });
       return;
    }

    const quiz = assessments[0];

    // Verify student is enrolled in the parent course (or bypass if Admin/Tutor/Manager)
    const userRoleNum = Number(req.user.roleId || (req.user as any).role_id || (req.user as any).role || 4);
    const isAdminOrTutor = userRoleNum === 1 || userRoleNum === 2 || userRoleNum === 3 || userRoleNum === 5;

    if (!isAdminOrTutor) {
      const [enrollments] = await pool.query<RowDataPacket[]>(
        `SELECT e.id FROM enrollments e 
         LEFT JOIN course_versions cv ON e.course_id = cv.course_id
         LEFT JOIN modules m ON cv.id = m.course_version_id
         LEFT JOIN lessons l ON m.id = l.module_id
         WHERE (e.course_id = ? OR l.id = ?) AND e.user_id = ? AND (e.status = 'ACTIVE' OR LOWER(e.status) = 'active') AND (e.expired_at IS NULL OR e.expired_at >= NOW())`,
        [quiz.course_id || 0, quiz.lesson_id || 0, req.user.id]
      );
      if (enrollments.length === 0) {
         res.status(403).json({ error: 'You are not enrolled in this course' });
         return;
      }

      // Sequential lesson lock check
      if (quiz.lesson_id) {
        const lockCheck = await checkSequentialLessonLock(pool, req.user.id, quiz.lesson_id);
        if (lockCheck.isLocked) {
          res.status(403).json({
            error: `Kuis "${quiz.title}" masih terkunci. Anda harus menyelesaikan materi "${lockCheck.requiredLessonTitle}" terlebih dahulu sesuai urutan pembelajaran.`,
            isLocked: true,
            requiredLessonId: lockCheck.requiredLessonId,
            requiredLessonTitle: lockCheck.requiredLessonTitle
          });
          return;
        }
      }
    }

    // Verify attempt limit if student role
    let isAttemptExceeded = false;
    let latestAttempt: any = null;
    if (req.user.roleId === 4) {
      const [attempts] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM assessment_attempts WHERE user_id = ? AND assessment_id = ?',
        [req.user.id, quiz.id]
      );
      const attemptCount = attempts[0]?.count || 0;
      if (quiz.max_attempt !== null && quiz.max_attempt > 0 && attemptCount >= quiz.max_attempt) {
        isAttemptExceeded = true;
        const [lastAttRows] = await pool.query<RowDataPacket[]>(
          'SELECT * FROM assessment_attempts WHERE user_id = ? AND assessment_id = ? ORDER BY id DESC LIMIT 1',
          [req.user.id, quiz.id]
        );
        latestAttempt = lastAttRows[0] || null;
      }
    }

    // 2. Fetch sections
    const [sections] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, instruction, section_order FROM assessment_sections WHERE assessment_id = ? ORDER BY section_order ASC',
      [quiz.id]
    );

    let questions: any[] = [];
    if (sections.length > 0) {
      const sectionIds = sections.map(s => s.id);
      
      // 3. Fetch questions
      const [questionRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, assessment_section_id, question_type_id, title, question_text, explanation, point, question_order, shuffle_option, question_image 
         FROM questions 
         WHERE assessment_section_id IN (${sectionIds.map(() => '?').join(',')}) AND status = 'ACTIVE' 
         ORDER BY question_order ASC`,
        sectionIds
      );

      questions = questionRows;

      if (questions.length > 0) {
        const questionIds = questions.map(q => q.id);

        // 4. Fetch options (if isAttemptExceeded, include is_correct for evaluation view)
        const [optionRows] = await pool.query<RowDataPacket[]>(
          `SELECT id, question_id, option_label, option_text, option_order, option_image${isAttemptExceeded ? ', is_correct' : ''} 
           FROM question_options 
           WHERE question_id IN (${questionIds.map(() => '?').join(',')}) 
           ORDER BY option_order ASC`,
          questionIds
        );

        // Attach options to questions
        for (const q of questions) {
          q.options = optionRows.filter(o => o.question_id === q.id);
        }
      }
    }

    res.json({
      quiz,
      sections,
      questions,
      isAttemptExceeded,
      latestAttempt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const submitAttempt = async (req: AuthRequest, res: Response) => {
  const { assessmentId, answers } = req.body; // answers: Array of { questionId, selectedOptionId }
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  if (!assessmentId || !Array.isArray(answers)) {
     res.status(400).json({ error: 'assessmentId and answers (array) are required' });
     return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch assessment details to know passing score and total questions
    const [assessments] = await connection.query<RowDataPacket[]>(
      `SELECT a.id, a.passing_score, a.total_score, a.course_id, a.lesson_id, l.max_attempt 
       FROM assessments a
       LEFT JOIN lessons l ON a.lesson_id = l.id
       WHERE a.id = ?`,
      [assessmentId]
    );

    if (assessments.length === 0) {
       res.status(404).json({ error: 'Assessment not found' });
       connection.release();
       return;
    }

    const quiz = assessments[0];

    // Verify student is enrolled in the parent course (or bypass if Admin/Tutor/Manager)
    const userRoleNum = Number(req.user.roleId || (req.user as any).role_id || (req.user as any).role || 4);
    const isAdminOrTutor = userRoleNum === 1 || userRoleNum === 2 || userRoleNum === 3 || userRoleNum === 5;

    if (!isAdminOrTutor) {
      const [enrollments] = await connection.query<RowDataPacket[]>(
        `SELECT e.id FROM enrollments e 
         LEFT JOIN course_versions cv ON e.course_id = cv.course_id
         LEFT JOIN modules m ON cv.id = m.course_version_id
         LEFT JOIN lessons l ON m.id = l.module_id
         WHERE (e.course_id = ? OR l.id = ?) AND e.user_id = ? AND (e.status = 'ACTIVE' OR LOWER(e.status) = 'active') AND (e.expired_at IS NULL OR e.expired_at >= NOW())`,
        [quiz.course_id || 0, quiz.lesson_id || 0, req.user.id]
      );
      if (enrollments.length === 0) {
         res.status(403).json({ error: 'You are not enrolled in this course' });
         await connection.rollback();
         connection.release();
         return;
      }

      // Sequential lock check
      if (quiz.lesson_id) {
        const lockCheck = await checkSequentialLessonLock(connection, req.user.id, quiz.lesson_id);
        if (lockCheck.isLocked) {
          res.status(403).json({
            error: `Kuis "${quiz.title}" masih terkunci. Anda harus menyelesaikan materi "${lockCheck.requiredLessonTitle}" terlebih dahulu.`,
            isLocked: true,
            requiredLessonId: lockCheck.requiredLessonId,
            requiredLessonTitle: lockCheck.requiredLessonTitle
          });
          await connection.rollback();
          connection.release();
          return;
        }
      }
    }

    // Verify attempt limit if student role
    if (req.user.roleId === 4) {
      const [attempts] = await connection.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM assessment_attempts WHERE user_id = ? AND assessment_id = ?',
        [req.user.id, assessmentId]
      );
      const attemptCount = attempts[0]?.count || 0;
      if (quiz.max_attempt !== null && quiz.max_attempt > 0 && attemptCount >= quiz.max_attempt) {
        res.status(403).json({ error: `You have reached the maximum number of attempts allowed for this assessment (${quiz.max_attempt})` });
        await connection.rollback();
        connection.release();
        return;
      }
    }

    // 2. Fetch all correct options for the questions of this assessment
    // First, find all sections
    const [sections] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM assessment_sections WHERE assessment_id = ?',
      [assessmentId]
    );
    const sectionIds = sections.map(s => s.id);

    if (sectionIds.length === 0) {
       res.status(400).json({ error: 'Quiz has no sections or questions' });
       connection.release();
       return;
    }

    // Find all questions
    const [questions] = await connection.query<RowDataPacket[]>(
      `SELECT id, assessment_section_id, question_type_id, title, question_text, explanation, point, question_image, question_order 
       FROM questions 
       WHERE assessment_section_id IN (${sectionIds.map(() => '?').join(',')}) AND status = 'ACTIVE'
       ORDER BY question_order ASC, id ASC`,
      sectionIds
    );

    const questionIds = questions.map(q => q.id);

    // Find all options including correct status
    const [allOptions] = await connection.query<RowDataPacket[]>(
      `SELECT id, question_id, option_label, option_text, is_correct, score, option_image, option_order 
       FROM question_options 
       WHERE question_id IN (${questionIds.map(() => '?').join(',')})
       ORDER BY option_order ASC, id ASC`,
      questionIds
    );

    // 3. Grade the user's answers and build detailed question-by-question evaluations
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalUnanswered = 0;
    let score = 0;

    const evaluations = questions.map((q, qIdx) => {
      const userAnsObj = answers.find((a: any) => Number(a.questionId) === q.id);
      const qOptions = allOptions.filter((opt: any) => opt.question_id === q.id);
      const correctOpt = qOptions.find((opt: any) => opt.is_correct === 1);

      let isAnswerCorrect = false;
      let studentAnswerText = '-';
      let correctAnswerText = correctOpt ? `${correctOpt.option_label ? correctOpt.option_label + '. ' : ''}${correctOpt.option_text}` : '-';

      if (!userAnsObj || (userAnsObj.selectedOptionId === undefined && !userAnsObj.answerText)) {
        studentAnswerText = '(Tidak dijawab)';
        totalUnanswered++;
      } else if (q.question_type_id === 4) { // FILL_BLANK
        const studentText = userAnsObj?.answerText ? String(userAnsObj.answerText).trim() : '';
        studentAnswerText = studentText || '(Tidak dijawab)';
        if (correctOpt && studentText) {
          isAnswerCorrect = studentText.toLowerCase() === String(correctOpt.option_text).trim().toLowerCase();
        }
      } else if (q.question_type_id === 6) { // ORDERING
        const studentText = userAnsObj?.answerText ? String(userAnsObj.answerText).trim() : '';
        studentAnswerText = studentText || '(Tidak dijawab)';
        if (correctOpt && studentText) {
          isAnswerCorrect = studentText.toLowerCase().replace(/\s+/g, ' ') === String(correctOpt.option_text).trim().toLowerCase().replace(/\s+/g, ' ');
        }
      } else { // MULTIPLE_CHOICE (1), TRUE_FALSE (3), etc.
        const chosenOpt = qOptions.find((opt: any) => opt.id === Number(userAnsObj?.selectedOptionId));
        if (chosenOpt) {
          studentAnswerText = `${chosenOpt.option_label ? chosenOpt.option_label + '. ' : ''}${chosenOpt.option_text}`;
          isAnswerCorrect = chosenOpt.is_correct === 1;
        } else {
          studentAnswerText = '(Tidak dijawab)';
        }
      }

      if (isAnswerCorrect) {
        totalCorrect++;
        score += Number(q.point);
      } else if (studentAnswerText !== '(Tidak dijawab)') {
        totalWrong++;
      }

      return {
        questionId: q.id,
        questionIndex: qIdx + 1,
        questionTitle: q.title || `Soal #${qIdx + 1}`,
        questionText: q.question_text,
        questionImage: q.question_image || null,
        questionTypeId: q.question_type_id,
        point: Number(q.point),
        earnedPoint: isAnswerCorrect ? Number(q.point) : 0,
        isCorrect: isAnswerCorrect,
        studentAnswer: studentAnswerText,
        correctAnswer: correctAnswerText,
        explanation: q.explanation || null,
        options: qOptions.map((opt: any) => ({
          id: opt.id,
          label: opt.option_label,
          text: opt.option_text,
          image: opt.option_image || null,
          isCorrect: opt.is_correct === 1,
          isChosen: userAnsObj && (Number(userAnsObj.selectedOptionId) === opt.id || (q.question_type_id === 4 && String(userAnsObj.answerText).trim().toLowerCase() === String(opt.option_text).trim().toLowerCase()))
        }))
      };
    });

    // Scale score to 100 or standard total_score
    const totalMaxPoints = questions.reduce((acc, q) => acc + Number(q.point), 0);
    const percentage = totalMaxPoints > 0 ? (score / totalMaxPoints) * 100.00 : 0.00;
    const passed = percentage >= Number(quiz.passing_score) ? 1 : 0;

    // 4. Insert attempt record
    const [attemptResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO assessment_attempts 
       (assessment_id, user_id, started_at, submitted_at, score, total_correct, total_wrong, total_unanswered, percentage, passed, status) 
       VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 5 MINUTE), NOW(), ?, ?, ?, ?, ?, ?, 'FINISHED')`,
      [assessmentId, req.user.id, score, totalCorrect, totalWrong, totalUnanswered, percentage, passed]
    );

    const attemptId = attemptResult.insertId;

    // 5. Update assessment progress for this user
    const [existingProgress] = await connection.query<RowDataPacket[]>(
      'SELECT id, highest_score, total_attempt, passed FROM assessment_progress WHERE user_id = ? AND assessment_id = ?',
      [req.user.id, assessmentId]
    );

    if (existingProgress.length > 0) {
      const highestScore = Math.max(Number(existingProgress[0].highest_score), percentage);
      const totalAttempts = Number(existingProgress[0].total_attempt) + 1;
      const alreadyPassed = existingProgress[0].passed || passed;

      await connection.query(
        `UPDATE assessment_progress 
         SET last_attempt = ?, highest_score = ?, total_attempt = ?, passed = ? 
         WHERE user_id = ? AND assessment_id = ?`,
        [attemptId, highestScore, totalAttempts, alreadyPassed, req.user.id, assessmentId]
      );
    } else {
      await connection.query(
        `INSERT INTO assessment_progress 
         (assessment_id, user_id, last_attempt, highest_score, total_attempt, passed) 
         VALUES (?, ?, ?, ?, 1, ?)`,
        [assessmentId, req.user.id, attemptId, percentage, passed]
      );
    }

    let awardXp = false;
    if (passed === 1) {
      if (existingProgress.length === 0 || existingProgress[0].passed === 0) {
        awardXp = true;
      }
    }

    if (awardXp) {
      await addXpTransaction(connection, req.user.id, 'QUIZ', 30, assessmentId, `Passed Quiz #${assessmentId}`);
      
      // Update statistics
      await connection.query(
        `INSERT INTO user_statistics (user_id, total_quiz) 
         VALUES (?, 1) 
         ON DUPLICATE KEY UPDATE 
         total_quiz = total_quiz + 1`,
        [req.user.id]
      );
    }

    // Automatically complete the parent lesson when student submits an attempt
    if (quiz.lesson_id) {
      await updateProgressHelper(connection, req.user.id, quiz.lesson_id, true, 100.00);
    }

    await connection.commit();
    res.json({
      message: 'Quiz attempt graded successfully',
      attemptId,
      score,
      percentage: Number(percentage.toFixed(1)),
      totalCorrect,
      totalWrong,
      totalUnanswered,
      passed: passed === 1,
      awardXp,
      evaluations
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    connection.release();
  }
};

export const getAttemptHistory = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    const [attempts] = await pool.query<RowDataPacket[]>(
      `SELECT aa.id, aa.assessment_id, aa.started_at, aa.submitted_at, aa.score, aa.percentage, aa.passed, aa.status, a.title as quiz_title,
              c.title as course_title
       FROM assessment_attempts aa 
       JOIN assessments a ON aa.assessment_id = a.id 
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE aa.user_id = ? 
       ORDER BY aa.submitted_at DESC`,
      [req.user.id]
    );

    res.json(attempts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getAttemptDetails = async (req: AuthRequest, res: Response) => {
  const { attemptId } = req.params;
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    // 1. Fetch attempt and quiz metadata
    const [attempts] = await pool.query<RowDataPacket[]>(
      `SELECT aa.*, a.title as quiz_title, a.show_answer 
       FROM assessment_attempts aa
       JOIN assessments a ON aa.assessment_id = a.id
       WHERE aa.id = ? AND aa.user_id = ?`,
      [attemptId, req.user.id]
    );

    if (attempts.length === 0) {
       res.status(404).json({ error: 'Attempt not found' });
       return;
    }

    const attempt = attempts[0];

    // 2. Fetch sections and questions
    const [sections] = await pool.query<RowDataPacket[]>(
      'SELECT id, title FROM assessment_sections WHERE assessment_id = ?',
      [attempt.assessment_id]
    );

    let questions: any[] = [];
    if (sections.length > 0) {
      const sectionIds = sections.map(s => s.id);
      const [questionRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, title, question_text, explanation, point 
         FROM questions 
         WHERE assessment_section_id IN (${sectionIds.map(() => '?').join(',')}) AND status = 'ACTIVE'`,
        sectionIds
      );
      questions = questionRows;

      if (questions.length > 0) {
        const questionIds = questions.map(q => q.id);
        
        // Fetch all options
        // If show_answer is false (0), we omit is_correct to prevent seeing correct options
        const fields = attempt.show_answer === 1 
          ? 'id, question_id, option_label, option_text, is_correct' 
          : 'id, question_id, option_label, option_text';
          
        const [optionRows] = await pool.query<RowDataPacket[]>(
          `SELECT ${fields} FROM question_options WHERE question_id IN (${questionIds.map(() => '?').join(',')})`,
          questionIds
        );

        for (const q of questions) {
          q.options = optionRows.filter(o => o.question_id === q.id);
        }
      }
    }

    res.json({
      attempt,
      questions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getAssessmentsByType = async (req: AuthRequest, res: Response) => {
  const { typeCode } = req.params;
  try {
    const [types] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM assessment_types WHERE code = ?',
      [typeCode]
    );
    if (types.length === 0) {
      res.status(404).json({ error: 'Assessment type not found' });
      return;
    }
    const typeId = types[0].id;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, description, instruction, passing_score, duration_minutes, total_question, total_score, status FROM assessments WHERE assessment_type_id = ? AND status = "PUBLISHED"',
      [typeId]
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
