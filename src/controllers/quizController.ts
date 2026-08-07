import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { addXpTransaction } from '../utils/xp';
import { updateProgressHelper } from '../utils/progress';

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

    // Verify student is enrolled in the parent course
    const [enrollments] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM enrollments WHERE course_id = ? AND user_id = ? AND status = 'ACTIVE'`,
      [quiz.course_id, req.user.id]
    );
    if (enrollments.length === 0) {
       res.status(403).json({ error: 'You are not enrolled in this course' });
       return;
    }

    // Verify attempt limit if student role
    if (req.user.roleId === 4) {
      const [attempts] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM assessment_attempts WHERE user_id = ? AND assessment_id = ?',
        [req.user.id, quiz.id]
      );
      const attemptCount = attempts[0]?.count || 0;
      if (quiz.max_attempt !== null && quiz.max_attempt > 0 && attemptCount >= quiz.max_attempt) {
        res.status(403).json({ error: `You have reached the maximum number of attempts allowed for this assessment (${quiz.max_attempt})` });
        return;
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

        // 4. Fetch options (hide 'is_correct' and 'score' to prevent cheating)
        const [optionRows] = await pool.query<RowDataPacket[]>(
          `SELECT id, question_id, option_label, option_text, option_order, option_image 
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
      questions
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

    // Verify student is enrolled in the parent course
    const [enrollments] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM enrollments WHERE course_id = ? AND user_id = ? AND status = 'ACTIVE'`,
      [quiz.course_id, req.user.id]
    );
    if (enrollments.length === 0) {
       res.status(403).json({ error: 'You are not enrolled in this course' });
       await connection.rollback();
       connection.release();
       return;
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
      `SELECT id, question_type_id, point FROM questions WHERE assessment_section_id IN (${sectionIds.map(() => '?').join(',')}) AND status = 'ACTIVE'`,
      sectionIds
    );
    const questionMap = new Map<number, { point: number; typeId: number }>(); // questionId -> { point, typeId }
    questions.forEach(q => questionMap.set(q.id, { point: Number(q.point), typeId: q.question_type_id }));

    const questionIds = questions.map(q => q.id);

    // Find correct options
    const [correctOptions] = await connection.query<RowDataPacket[]>(
      `SELECT id, question_id, is_correct, score, option_text 
       FROM question_options 
       WHERE question_id IN (${questionIds.map(() => '?').join(',')})`,
      questionIds
    );

    // 3. Grade the user's answers
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalUnanswered = questions.length - answers.length;
    let score = 0;

    answers.forEach(ans => {
      const { questionId, selectedOptionId, answerText } = ans;
      const qInfo = questionMap.get(questionId);
      if (!qInfo) return;

      const qCorrectOptions = correctOptions.filter(opt => opt.question_id === questionId);
      const firstCorrectOption = qCorrectOptions.find(opt => opt.is_correct === 1);

      let isAnswerCorrect = false;

      if (qInfo.typeId === 4) { // FILL_BLANK
        // Compare answerText case-insensitive and trimmed with first correct option text
        if (firstCorrectOption && answerText) {
          const studentAns = String(answerText).trim().toLowerCase();
          const correctAns = String(firstCorrectOption.option_text).trim().toLowerCase();
          isAnswerCorrect = studentAns === correctAns;
        }
      } else if (qInfo.typeId === 6) { // ORDERING
        // For ordering, student might send the full sentence in answerText or option IDs
        if (firstCorrectOption && answerText) {
          const studentAns = String(answerText).trim().toLowerCase().replace(/\s+/g, ' ');
          const correctAns = String(firstCorrectOption.option_text).trim().toLowerCase().replace(/\s+/g, ' ');
          isAnswerCorrect = studentAns === correctAns;
        } else if (firstCorrectOption && selectedOptionId) {
          isAnswerCorrect = Number(selectedOptionId) === firstCorrectOption.id;
        }
      } else { // MULTIPLE_CHOICE (1), TRUE_FALSE (3), etc.
        if (firstCorrectOption && selectedOptionId) {
          isAnswerCorrect = Number(selectedOptionId) === firstCorrectOption.id;
        }
      }

      if (isAnswerCorrect) {
        totalCorrect++;
        score += qInfo.point;
      } else {
        totalWrong++;
      }
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
      percentage,
      totalCorrect,
      totalWrong,
      totalUnanswered,
      passed: passed === 1,
      awardXp
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
