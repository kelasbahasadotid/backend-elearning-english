import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { addXpTransaction } from '../utils/xp';
import { updateProgressHelper, checkSequentialLessonLock } from '../utils/progress';
import { extractVocabFromQuiz, recordVocabularyItem } from '../services/vocabularyService';


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

      // Determine if random_question is enabled (real column or legacy hidden-marker)
      const hasShuffleQuestionsMarker = Boolean(
        (quiz.instruction && /\[SHUFFLE_QUESTIONS?\]|<!--\s*SHUFFLE_QUESTIONS?\s*-->|\[RANDOM_QUESTIONS?\]/i.test(quiz.instruction)) ||
        (quiz.description && /\[SHUFFLE_QUESTIONS?\]|<!--\s*SHUFFLE_QUESTIONS?\s*-->|\[RANDOM_QUESTIONS?\]/i.test(quiz.description))
      );
      const isRandomQuestionEnabled = Boolean(quiz.random_question === 1 || quiz.random_question === true || hasShuffleQuestionsMarker);

      // Determine if shuffle_option is enabled on quiz level
      const hasShuffleOptionsMarker = Boolean(
        (quiz.instruction && /\[SHUFFLE_OPTIONS?\]|<!--\s*SHUFFLE_OPTIONS?\s*-->/i.test(quiz.instruction)) ||
        (quiz.description && /\[SHUFFLE_OPTIONS?\]|<!--\s*SHUFFLE_OPTIONS?\s*-->/i.test(quiz.description))
      );
      const isQuizShuffleOptionEnabled = Boolean(quiz.shuffle_option === 1 || quiz.shuffle_option === true || hasShuffleOptionsMarker);

      // Clean any legacy hidden-markers from instruction and description for clean presentation
      if (quiz.instruction) {
        quiz.instruction = quiz.instruction.replace(/\[SHUFFLE_QUESTIONS?\]|\[RANDOM_QUESTIONS?\]|\[SHUFFLE_OPTIONS?\]|<!--\s*SHUFFLE_[A-Z]+\s*-->/gi, '').trim();
      }
      if (quiz.description) {
        quiz.description = quiz.description.replace(/\[SHUFFLE_QUESTIONS?\]|\[RANDOM_QUESTIONS?\]|\[SHUFFLE_OPTIONS?\]|<!--\s*SHUFFLE_[A-Z]+\s*-->/gi, '').trim();
      }

      // Expose normalized boolean flags on quiz object
      quiz.random_question = isRandomQuestionEnabled ? 1 : 0;
      quiz.shuffle_option = isQuizShuffleOptionEnabled ? 1 : 0;
      quiz.randomQuestion = isRandomQuestionEnabled;
      quiz.shuffleOption = isQuizShuffleOptionEnabled;

      // 4. Randomize / shuffle question order if enabled and user is student
      if (isRandomQuestionEnabled && !isAdminOrTutor && !isAttemptExceeded) {
        questions = [...questionRows].sort(() => Math.random() - 0.5);
      } else {
        questions = questionRows;
      }

      if (questions.length > 0) {
        const questionIds = questions.map(q => q.id);

        // 5. Fetch options (if isAttemptExceeded, include is_correct for evaluation view)
        const [optionRows] = await pool.query<RowDataPacket[]>(
          `SELECT id, question_id, option_label, option_text, option_order, option_image${isAttemptExceeded ? ', is_correct' : ''} 
           FROM question_options 
           WHERE question_id IN (${questionIds.map(() => '?').join(',')}) 
           ORDER BY option_order ASC`,
          questionIds
        );

        // Attach options to questions
        for (const q of questions) {
          const rawOpts = optionRows.filter(o => o.question_id === q.id);
          const shouldShuffleThisQuestion = Boolean((isQuizShuffleOptionEnabled || q.shuffle_option === 1 || q.shuffle_option === true) && !isAdminOrTutor && !isAttemptExceeded);

          if (q.question_type_id === 5) { // MATCHING / PENCOCOKAN
            // 1. Collect all target match texts and shuffle them for student choices
            const matchTargets = rawOpts.map((o: any) => o.option_text).filter(Boolean);
            const shuffledChoices = [...matchTargets].sort(() => Math.random() - 0.5);
            q.matchChoices = shuffledChoices;

            // 2. Shuffle the left premises (soal) if option shuffle is enabled
            const shuffledPremises = shouldShuffleThisQuestion
              ? [...rawOpts].sort(() => Math.random() - 0.5)
              : rawOpts;

            q.options = (!isAdminOrTutor && !isAttemptExceeded)
              ? shuffledPremises.map((o: any) => ({
                  id: o.id,
                  question_id: o.question_id,
                  option_label: o.option_label,
                  option_order: o.option_order,
                  option_image: o.option_image
                }))
              : shuffledPremises;
          } else if (shouldShuffleThisQuestion) {
            // Standard questions with shuffle option enabled
            q.options = [...rawOpts].sort(() => Math.random() - 0.5);
          } else {
            q.options = rawOpts;
          }
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
  const { assessmentId, answers } = req.body; // answers: Array of { questionId, selectedOptionId, selectedOptionIds, matchingAnswers, pairs, answerText }
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
      let earnedPoint = 0;
      let studentAnswerText = '-';
      let correctAnswerText = correctOpt ? `${correctOpt.option_label ? correctOpt.option_label + '. ' : ''}${correctOpt.option_text}` : '-';

      const isBlankAnswer = !userAnsObj || (
        userAnsObj.selectedOptionId === undefined &&
        !userAnsObj.answerText &&
        !userAnsObj.matchingAnswers &&
        !userAnsObj.pairs &&
        !userAnsObj.selectedMatches &&
        !userAnsObj.selectedOptionIds
      );

      if (isBlankAnswer) {
        studentAnswerText = '(Tidak dijawab)';
        totalUnanswered++;
      } else if (q.question_type_id === 2) { // MULTIPLE_SELECT / MULTI_CHOICE
        const submittedIds: number[] = Array.isArray(userAnsObj.selectedOptionIds)
          ? userAnsObj.selectedOptionIds.map(Number)
          : Array.isArray(userAnsObj.selectedOptionId)
            ? userAnsObj.selectedOptionId.map(Number)
            : userAnsObj.selectedOptionId !== undefined
              ? [Number(userAnsObj.selectedOptionId)]
              : [];

        const correctOptIds = qOptions.filter((opt: any) => opt.is_correct === 1).map((opt: any) => opt.id);
        const chosenOpts = qOptions.filter((opt: any) => submittedIds.includes(opt.id));

        studentAnswerText = chosenOpts.length > 0
          ? chosenOpts.map((opt: any) => `${opt.option_label ? opt.option_label + '. ' : ''}${opt.option_text}`).join(', ')
          : '(Tidak dijawab)';

        const correctOpts = qOptions.filter((opt: any) => opt.is_correct === 1);
        correctAnswerText = correctOpts.map((opt: any) => `${opt.option_label ? opt.option_label + '. ' : ''}${opt.option_text}`).join(', ');

        const allCorrectFound = correctOptIds.length > 0 &&
                                correctOptIds.every(id => submittedIds.includes(id)) &&
                                submittedIds.every(id => correctOptIds.includes(id));

        isAnswerCorrect = allCorrectFound;
        if (isAnswerCorrect) {
          earnedPoint = Number(q.point);
        }
      } else if (q.question_type_id === 4) { // FILL_BLANK
        const studentText = userAnsObj?.answerText ? String(userAnsObj.answerText).trim() : '';
        studentAnswerText = studentText || '(Tidak dijawab)';
        if (correctOpt && studentText) {
          isAnswerCorrect = studentText.toLowerCase() === String(correctOpt.option_text).trim().toLowerCase();
        }
        if (isAnswerCorrect) {
          earnedPoint = Number(q.point);
        }
      } else if (q.question_type_id === 5) { // MATCHING / PENCOCOKAN
        const rawMatching = userAnsObj.matchingAnswers || userAnsObj.pairs || userAnsObj.selectedMatches || userAnsObj.matches || userAnsObj.answers;
        let submittedPairs: Array<{ optionId?: number; left?: string; matchText: string }> = [];

        if (Array.isArray(rawMatching)) {
          submittedPairs = rawMatching.map((item: any) => {
            let mText = '';
            if (item.matchText !== undefined) mText = String(item.matchText);
            else if (item.selectedMatch !== undefined) mText = String(item.selectedMatch);
            else if (item.match !== undefined) mText = String(item.match);
            else if (item.right !== undefined) mText = String(item.right);
            else if (item.optionText !== undefined) mText = String(item.optionText);
            else if (item.option_text !== undefined) mText = String(item.option_text);
            else if (item.answer !== undefined) mText = String(item.answer);
            else if (item.target !== undefined) mText = String(item.target);

            if (!mText && (item.matchOptionId || item.rightOptionId || item.targetOptionId)) {
              const targetId = Number(item.matchOptionId || item.rightOptionId || item.targetOptionId);
              const foundOpt = qOptions.find((o: any) => o.id === targetId);
              if (foundOpt) mText = String(foundOpt.option_text);
            }

            return {
              optionId: item.optionId !== undefined ? Number(item.optionId) : (item.id !== undefined ? Number(item.id) : (item.leftId !== undefined ? Number(item.leftId) : undefined)),
              left: item.left ?? item.premise ?? item.optionLabel ?? item.option_label,
              matchText: mText.trim()
            };
          });
        } else if (rawMatching && typeof rawMatching === 'object') {
          submittedPairs = Object.entries(rawMatching).map(([key, val]) => {
            let mText = String(val).trim();
            if (!isNaN(Number(mText))) {
              const foundOpt = qOptions.find((o: any) => o.id === Number(mText));
              if (foundOpt) mText = String(foundOpt.option_text).trim();
            }
            return {
              optionId: !isNaN(Number(key)) ? Number(key) : undefined,
              left: isNaN(Number(key)) ? key : undefined,
              matchText: mText
            };
          });
        }

        let correctPairsCount = 0;
        const totalPairs = qOptions.length;
        const studentPairStrs: string[] = [];
        const correctPairStrs: string[] = [];

        for (const opt of qOptions) {
          correctPairStrs.push(`${opt.option_label} ➔ ${opt.option_text}`);
          const studentPair = submittedPairs.find(sp =>
            (sp.optionId !== undefined && sp.optionId === opt.id) ||
            (sp.left !== undefined && String(sp.left).trim().toLowerCase() === String(opt.option_label).trim().toLowerCase())
          );

          if (studentPair && studentPair.matchText) {
            studentPairStrs.push(`${opt.option_label} ➔ ${studentPair.matchText}`);
            if (studentPair.matchText.toLowerCase() === String(opt.option_text).trim().toLowerCase()) {
              correctPairsCount++;
            }
          } else {
            studentPairStrs.push(`${opt.option_label} ➔ (Belum dicocokkan)`);
          }
        }

        studentAnswerText = studentPairStrs.join(' | ') || '(Tidak dijawab)';
        correctAnswerText = correctPairStrs.join(' | ');
        isAnswerCorrect = totalPairs > 0 && correctPairsCount === totalPairs;

        // Partial or full scoring for matching
        if (totalPairs > 0) {
          earnedPoint = Number(((correctPairsCount / totalPairs) * Number(q.point)).toFixed(2));
        }
      } else if (q.question_type_id === 6) { // ORDERING
        const studentText = userAnsObj?.answerText ? String(userAnsObj.answerText).trim() : '';
        studentAnswerText = studentText || '(Tidak dijawab)';
        if (correctOpt && studentText) {
          isAnswerCorrect = studentText.toLowerCase().replace(/\s+/g, ' ') === String(correctOpt.option_text).trim().toLowerCase().replace(/\s+/g, ' ');
        }
        if (isAnswerCorrect) {
          earnedPoint = Number(q.point);
        }
      } else { // MULTIPLE_CHOICE (1), TRUE_FALSE (3), etc.
        const chosenOpt = qOptions.find((opt: any) => opt.id === Number(userAnsObj?.selectedOptionId));
        if (chosenOpt) {
          studentAnswerText = `${chosenOpt.option_label ? chosenOpt.option_label + '. ' : ''}${chosenOpt.option_text}`;
          isAnswerCorrect = chosenOpt.is_correct === 1;
        } else {
          studentAnswerText = '(Tidak dijawab)';
        }
        if (isAnswerCorrect) {
          earnedPoint = Number(q.point);
        }
      }

      if (isAnswerCorrect) {
        totalCorrect++;
        score += earnedPoint;
      } else if (studentAnswerText !== '(Tidak dijawab)') {
        totalWrong++;
        score += earnedPoint; // Add partial score if earned
      }

      // Build detailed per-pair feedback for matching questions
      let matchingPairsList: any[] = [];
      if (q.question_type_id === 5) {
        const rawMatching = userAnsObj ? (userAnsObj.matchingAnswers || userAnsObj.pairs || userAnsObj.selectedMatches || userAnsObj.matches || userAnsObj.answers) : null;
        let submittedPairs: Array<{ optionId?: number; left?: string; matchText: string }> = [];

        if (Array.isArray(rawMatching)) {
          submittedPairs = rawMatching.map((item: any) => {
            let mText = '';
            if (item.matchText !== undefined) mText = String(item.matchText);
            else if (item.selectedMatch !== undefined) mText = String(item.selectedMatch);
            else if (item.match !== undefined) mText = String(item.match);
            else if (item.right !== undefined) mText = String(item.right);
            else if (item.optionText !== undefined) mText = String(item.optionText);
            else if (item.option_text !== undefined) mText = String(item.option_text);
            else if (item.answer !== undefined) mText = String(item.answer);
            else if (item.target !== undefined) mText = String(item.target);

            if (!mText && (item.matchOptionId || item.rightOptionId || item.targetOptionId)) {
              const targetId = Number(item.matchOptionId || item.rightOptionId || item.targetOptionId);
              const foundOpt = qOptions.find((o: any) => o.id === targetId);
              if (foundOpt) mText = String(foundOpt.option_text);
            }

            return {
              optionId: item.optionId !== undefined ? Number(item.optionId) : (item.id !== undefined ? Number(item.id) : undefined),
              left: item.left ?? item.premise ?? item.optionLabel ?? item.option_label,
              matchText: mText.trim()
            };
          });
        } else if (rawMatching && typeof rawMatching === 'object') {
          submittedPairs = Object.entries(rawMatching).map(([key, val]) => {
            let mText = String(val).trim();
            if (!isNaN(Number(mText))) {
              const foundOpt = qOptions.find((o: any) => o.id === Number(mText));
              if (foundOpt) mText = String(foundOpt.option_text).trim();
            }
            return {
              optionId: !isNaN(Number(key)) ? Number(key) : undefined,
              left: isNaN(Number(key)) ? key : undefined,
              matchText: mText
            };
          });
        }

        const totalPairs = qOptions.length;
        const pairPoint = totalPairs > 0 ? Math.round((Number(q.point) / totalPairs) * 100) / 100 : 0;

        for (const opt of qOptions) {
          const sp = submittedPairs.find(p =>
            (p.optionId !== undefined && p.optionId === opt.id) ||
            (p.left !== undefined && String(p.left).trim().toLowerCase() === String(opt.option_label).trim().toLowerCase())
          );
          const studentMatch = sp?.matchText || null;
          const isPairMatch = Boolean(studentMatch && studentMatch.toLowerCase() === String(opt.option_text).trim().toLowerCase());
          const status: 'CORRECT' | 'INCORRECT' | 'UNMATCHED' = isPairMatch
            ? 'CORRECT'
            : (studentMatch ? 'INCORRECT' : 'UNMATCHED');

          const feedback = isPairMatch
            ? `✅ Benar! "${opt.option_label}" berpasangan tepat dengan "${opt.option_text}".`
            : (studentMatch
                ? `❌ Kurang tepat. "${opt.option_label}" berpasangan dengan "${opt.option_text}" (jawaban Anda: "${studentMatch}").`
                : `⚠️ Belum dicocokkan. Pasangan yang benar untuk "${opt.option_label}" adalah "${opt.option_text}".`);

          matchingPairsList.push({
            id: opt.id,
            optionId: opt.id,
            label: opt.option_label,
            premise: opt.option_label,
            left: opt.option_label,
            image: opt.option_image || null,
            studentMatch,
            userMatch: studentMatch,
            correctMatch: opt.option_text,
            targetMatch: opt.option_text,
            right: opt.option_text,
            isPairMatch,
            isCorrect: isPairMatch,
            status,
            feedback,
            pairFeedback: feedback,
            point: pairPoint,
            earnedPoint: isPairMatch ? pairPoint : 0
          });
        }
      }

      return {
        questionId: q.id,
        questionIndex: qIdx + 1,
        questionTitle: q.title || `Soal #${qIdx + 1}`,
        questionText: q.question_text,
        questionImage: q.question_image || null,
        questionTypeId: q.question_type_id,
        point: Number(q.point),
        earnedPoint: earnedPoint,
        isCorrect: isAnswerCorrect,
        studentAnswer: studentAnswerText,
        correctAnswer: correctAnswerText,
        explanation: q.explanation || null,
        pairs: q.question_type_id === 5 ? matchingPairsList : undefined,
        pairFeedback: q.question_type_id === 5 ? matchingPairsList : undefined,
        options: qOptions.map((opt: any) => {
          let isChosen = false;
          let studentMatch = null;
          let isPairMatch = false;
          let pairStatus = undefined;
          let pairFeedback = undefined;

          if (q.question_type_id === 5) {
            const pr = matchingPairsList.find(p => p.id === opt.id);
            if (pr) {
              studentMatch = pr.studentMatch;
              isPairMatch = pr.isPairMatch;
              pairStatus = pr.status;
              pairFeedback = pr.feedback;
            }
          } else if (userAnsObj) {
            if (q.question_type_id === 2) {
              const subIds = Array.isArray(userAnsObj.selectedOptionIds) ? userAnsObj.selectedOptionIds.map(Number) : [Number(userAnsObj.selectedOptionId)];
              isChosen = subIds.includes(opt.id);
            } else if (q.question_type_id === 4) {
              isChosen = String(userAnsObj.answerText || '').trim().toLowerCase() === String(opt.option_text).trim().toLowerCase();
            } else {
              isChosen = Number(userAnsObj.selectedOptionId) === opt.id;
            }
          }

          return {
            id: opt.id,
            label: opt.option_label,
            text: opt.option_text,
            image: opt.option_image || null,
            isCorrect: q.question_type_id === 5 ? isPairMatch : opt.is_correct === 1,
            isChosen,
            studentMatch,
            isPairMatch: q.question_type_id === 5 ? isPairMatch : undefined,
            status: pairStatus,
            feedback: pairFeedback,
            pairFeedback: pairFeedback
          };
        })
      };
    });

    // Scale score to 100 or standard total_score
    const totalMaxPoints = questions.reduce((acc, q) => acc + Number(q.point), 0);
    const percentage = totalMaxPoints > 0 ? (score / totalMaxPoints) * 100.00 : 0.00;
    const passed = percentage >= Number(quiz.passing_score) ? 1 : 0;

    // 4. Insert attempt record (quiz session)
    const durationSeconds = Number(req.body?.durationSeconds || req.body?.duration_seconds) > 0 
      ? Number(req.body?.durationSeconds || req.body?.duration_seconds) 
      : 300;

    const [attemptResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO assessment_attempts 
       (assessment_id, user_id, started_at, submitted_at, duration_seconds, score, total_correct, total_wrong, total_unanswered, percentage, passed, status) 
       VALUES (?, ?, DATE_SUB(NOW(), INTERVAL ? SECOND), NOW(), ?, ?, ?, ?, ?, ?, ?, 'FINISHED')`,
      [assessmentId, req.user.id, durationSeconds, durationSeconds, score, totalCorrect, totalWrong, totalUnanswered, percentage, passed]
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

    // Auto-capture vocabulary into student's personal vocabulary room
    let vocabResults: any[] = [];
    try {
      vocabResults = await extractVocabFromQuiz(
        req.user.id,
        assessmentId,
        quiz.title || `Quiz #${assessmentId}`,
        questions,
        answers
      );
    } catch (vErr: any) {
      console.warn('[Vocabulary] Auto-capture from quiz error:', vErr.message);
    }

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
      evaluations,
      vocabularyCollected: {
        total: vocabResults.length,
        items: vocabResults.map(v => ({
          id: v.item.id,
          term: v.item.term,
          isDuplicate: v.isDuplicate,
          encounterCount: v.item.encounter_count,
          duplicateMessage: v.duplicateInfo?.message || null
        }))
      }
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
    const isAdminOrTutor = req.user.roleId === 1 || req.user.roleId === 2 || req.user.roleId === 3 || req.user.roleId === 5;
    const targetUserId = (isAdminOrTutor && req.query.userId) ? Number(req.query.userId) : req.user.id;
    const { assessmentId, courseId, lessonId } = req.query;

    let query = `
      SELECT aa.id, aa.id as attempt_id, aa.assessment_id, 
             aa.started_at, aa.submitted_at, aa.duration_seconds,
             aa.score, aa.percentage, aa.passed, 
             aa.total_correct, aa.total_wrong, aa.total_unanswered,
             aa.status, 
             a.title as quiz_title, a.passing_score,
             l.id as lesson_id, l.title as lesson_title,
             c.id as course_id, c.title as course_title, c.slug as course_slug
      FROM assessment_attempts aa 
      JOIN assessments a ON aa.assessment_id = a.id 
      LEFT JOIN lessons l ON a.lesson_id = l.id
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE aa.user_id = ?
    `;
    const params: any[] = [targetUserId];

    if (assessmentId) {
      query += ' AND aa.assessment_id = ?';
      params.push(assessmentId);
    }
    if (courseId) {
      query += ' AND a.course_id = ?';
      params.push(courseId);
    }
    if (lessonId) {
      query += ' AND a.lesson_id = ?';
      params.push(lessonId);
    }

    query += ' ORDER BY aa.submitted_at DESC';

    const [attempts] = await pool.query<RowDataPacket[]>(query, params);

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

/**
 * Instant Per-Question Feedback & Correction Controller
 * Evaluates a single question answer on the fly and returns immediate correction,
 * points, explanation, and answer breakdown for any quiz question type.
 */
export const checkSingleQuestion = async (req: AuthRequest, res: Response) => {
  const { questionId, selectedOptionId, selectedOptionIds, matchingAnswers, pairs, answerText } = req.body;

  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!questionId) {
    res.status(400).json({ error: 'questionId is required' });
    return;
  }

  try {
    // 1. Fetch Question details
    const [qRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, assessment_section_id, question_type_id, title, question_text, explanation, point, question_image 
       FROM questions 
       WHERE id = ?`,
      [questionId]
    );

    if (qRows.length === 0) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    const q = qRows[0];

    // 2. Fetch Options with correct flags
    const [optionRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, question_id, option_label, option_text, is_correct, score, option_order, option_image 
       FROM question_options 
       WHERE question_id = ? 
       ORDER BY option_order ASC`,
      [questionId]
    );

    let isAnswerCorrect = false;
    let earnedPoint = 0;
    let studentAnswerText = '';
    let correctAnswerText = '';
    let pairResults: any[] = [];

    const correctOpts = optionRows.filter(o => o.is_correct === 1 || o.is_correct === true);
    const correctOpt = correctOpts[0];
    correctAnswerText = correctOpts.map(o => `${o.option_label ? o.option_label + '. ' : ''}${o.option_text}`).join(', ') || '-';

    if (q.question_type_id === 1 || q.question_type_id === 3) {
      // Multiple Choice / True False (Single Option)
      const chosenOpt = optionRows.find(o => o.id === Number(selectedOptionId));
      studentAnswerText = chosenOpt ? `${chosenOpt.option_label ? chosenOpt.option_label + '. ' : ''}${chosenOpt.option_text}` : '(Tidak dijawab)';
      if (chosenOpt && (chosenOpt.is_correct === 1 || chosenOpt.is_correct === true)) {
        isAnswerCorrect = true;
        earnedPoint = Number(q.point || chosenOpt.score || 20);
      }
    } else if (q.question_type_id === 2) {
      // Multiple Select (Multi Answer)
      const chosenIds = Array.isArray(selectedOptionIds)
        ? selectedOptionIds.map(Number)
        : (selectedOptionId !== undefined ? [Number(selectedOptionId)] : []);
      const chosenOpts = optionRows.filter(o => chosenIds.includes(o.id));
      studentAnswerText = chosenOpts.map(o => `${o.option_label ? o.option_label + '. ' : ''}${o.option_text}`).join(', ') || '(Tidak dijawab)';

      const correctIds = correctOpts.map(o => o.id);
      const isAllCorrectChosen = correctIds.length > 0 && correctIds.every(id => chosenIds.includes(id));
      const hasNoWrongChosen = chosenIds.every(id => correctIds.includes(id));
      isAnswerCorrect = isAllCorrectChosen && hasNoWrongChosen;
      if (isAnswerCorrect) {
        earnedPoint = Number(q.point);
      }
    } else if (q.question_type_id === 4) {
      // Fill in the blank
      const sText = answerText ? String(answerText).trim() : '';
      studentAnswerText = sText || '(Tidak dijawab)';
      if (correctOpt && sText) {
        isAnswerCorrect = sText.toLowerCase() === String(correctOpt.option_text).trim().toLowerCase();
      }
      if (isAnswerCorrect) {
        earnedPoint = Number(q.point);
      }
    } else if (q.question_type_id === 5) {
      // Matching Pairs (Pencocokan Pasangan)
      const rawMatching = matchingAnswers || pairs || req.body.selectedMatches || req.body.matches || req.body.answers;
      let submittedPairs: Array<{ optionId?: number; left?: string; matchText: string }> = [];

      if (Array.isArray(rawMatching)) {
        submittedPairs = rawMatching.map((item: any) => {
          let mText = '';
          if (item.matchText !== undefined) mText = String(item.matchText);
          else if (item.selectedMatch !== undefined) mText = String(item.selectedMatch);
          else if (item.match !== undefined) mText = String(item.match);
          else if (item.right !== undefined) mText = String(item.right);
          else if (item.optionText !== undefined) mText = String(item.optionText);
          else if (item.option_text !== undefined) mText = String(item.option_text);
          else if (item.answer !== undefined) mText = String(item.answer);
          else if (item.target !== undefined) mText = String(item.target);

          if (!mText && (item.matchOptionId || item.rightOptionId || item.targetOptionId)) {
            const targetId = Number(item.matchOptionId || item.rightOptionId || item.targetOptionId);
            const foundOpt = optionRows.find((o: any) => o.id === targetId);
            if (foundOpt) mText = String(foundOpt.option_text);
          }

          return {
            optionId: item.optionId !== undefined ? Number(item.optionId) : (item.id !== undefined ? Number(item.id) : (item.leftId !== undefined ? Number(item.leftId) : undefined)),
            left: item.left ?? item.premise ?? item.optionLabel ?? item.option_label,
            matchText: mText.trim()
          };
        });
      } else if (rawMatching && typeof rawMatching === 'object') {
        submittedPairs = Object.entries(rawMatching).map(([key, val]) => {
          let mText = String(val).trim();
          if (!isNaN(Number(mText))) {
            const foundOpt = optionRows.find((o: any) => o.id === Number(mText));
            if (foundOpt) mText = String(foundOpt.option_text).trim();
          }
          return {
            optionId: !isNaN(Number(key)) ? Number(key) : undefined,
            left: isNaN(Number(key)) ? key : undefined,
            matchText: mText
          };
        });
      }

      let correctCount = 0;
      const totalPairs = optionRows.length;
      const studentPairStrs: string[] = [];
      const correctPairStrs: string[] = [];
      const pairPoint = totalPairs > 0 ? Math.round((Number(q.point) / totalPairs) * 100) / 100 : 0;

      for (const opt of optionRows) {
        correctPairStrs.push(`${opt.option_label} ➔ ${opt.option_text}`);
        const studentPair = submittedPairs.find(sp =>
          (sp.optionId !== undefined && sp.optionId === opt.id) ||
          (sp.left !== undefined && String(sp.left).trim().toLowerCase() === String(opt.option_label).trim().toLowerCase())
        );

        const sMatch = studentPair?.matchText || '';
        const isPairMatch = Boolean(sMatch && sMatch.toLowerCase() === String(opt.option_text).trim().toLowerCase());
        if (isPairMatch) {
          correctCount++;
        }

        if (sMatch) {
          studentPairStrs.push(`${opt.option_label} ➔ ${sMatch}`);
        } else {
          studentPairStrs.push(`${opt.option_label} ➔ (Belum dicocokkan)`);
        }

        const pairStatus: 'CORRECT' | 'INCORRECT' | 'UNMATCHED' = isPairMatch
          ? 'CORRECT'
          : (sMatch ? 'INCORRECT' : 'UNMATCHED');

        const pairFeedback = isPairMatch
          ? `✅ Benar! "${opt.option_label}" berpasangan tepat dengan "${opt.option_text}".`
          : (sMatch
              ? `❌ Kurang tepat. Pasangan yang benar untuk "${opt.option_label}" adalah "${opt.option_text}" (jawaban Anda: "${sMatch}").`
              : `⚠️ Belum dicocokkan. Pasangan yang tepat untuk "${opt.option_label}" adalah "${opt.option_text}".`);

        pairResults.push({
          id: opt.id,
          optionId: opt.id,
          label: opt.option_label,
          premise: opt.option_label,
          left: opt.option_label,
          image: opt.option_image || null,
          studentMatch: sMatch || null,
          userMatch: sMatch || null,
          correctMatch: opt.option_text,
          targetMatch: opt.option_text,
          right: opt.option_text,
          isPairMatch,
          isCorrect: isPairMatch,
          status: pairStatus,
          feedback: pairFeedback,
          pairFeedback: pairFeedback,
          point: pairPoint,
          earnedPoint: isPairMatch ? pairPoint : 0
        });
      }

      studentAnswerText = studentPairStrs.join(' | ') || '(Tidak dijawab)';
      correctAnswerText = correctPairStrs.join(' | ');
      isAnswerCorrect = totalPairs > 0 && correctCount === totalPairs;
      earnedPoint = totalPairs > 0 ? (correctCount / totalPairs) * Number(q.point) : 0;
    } else if (q.question_type_id === 6) {
      // Ordering
      const sText = answerText ? String(answerText).trim() : '';
      studentAnswerText = sText || '(Tidak dijawab)';
      if (correctOpt && sText) {
        isAnswerCorrect = sText.toLowerCase() === String(correctOpt.option_text).trim().toLowerCase();
      }
      if (isAnswerCorrect) {
        earnedPoint = Number(q.point);
      }
    }

    let feedbackMsg = '';
    if (q.question_type_id === 5) {
      const totalPairs = optionRows.length;
      const correctCount = pairResults.filter(p => p.isPairMatch).length;
      if (isAnswerCorrect) {
        feedbackMsg = `🎉 Luar biasa! Semua pasangan (${correctCount}/${totalPairs}) berhasil dicocokkan dengan benar!`;
      } else if (correctCount > 0) {
        feedbackMsg = `👍 Anda berhasil mencocokkan ${correctCount} dari ${totalPairs} pasangan dengan benar. Silakan periksa kolom feedback pada tiap pasangan.`;
      } else {
        feedbackMsg = `❌ Belum ada pasangan yang cocok (0/${totalPairs}). Silakan periksa kolom feedback per-pasangan di bawah.`;
      }
    } else {
      feedbackMsg = isAnswerCorrect
        ? '🎉 Jawaban Anda Benar! Kerja bagus.'
        : '❌ Jawaban Kurang Tepat. Pelajari pembahasan di bawah ini.';
    }

    // Auto-capture vocabulary into student room
    let vocabCaptured: any = null;
    try {
      if (q.question_type_id === 5) {
        for (const pr of pairResults) {
          if (pr.label && pr.correctMatch) {
            vocabCaptured = await recordVocabularyItem({
              userId: req.user.id,
              term: String(pr.label).trim(),
              translation: String(pr.correctMatch).trim(),
              contextSentence: q.question_text || 'Matching Practice',
              sourceType: 'QUIZ',
              sourceId: Number(questionId),
              sourceTitle: 'Quiz Practice'
            });
          }
        }
      } else if (studentAnswerText && studentAnswerText !== '(Tidak dijawab)') {
        vocabCaptured = await recordVocabularyItem({
          userId: req.user.id,
          term: studentAnswerText,
          translation: correctAnswerText && correctAnswerText !== studentAnswerText ? `Kunci: ${correctAnswerText}` : null,
          contextSentence: q.question_text || 'Quiz Practice',
          sourceType: 'QUIZ',
          sourceId: Number(questionId),
          sourceTitle: 'Quiz Practice'
        });
      }
    } catch (vErr: any) {
      console.warn('[Vocabulary] Check single question capture error:', vErr.message);
    }

    res.json({
      questionId: Number(questionId),
      questionTypeId: q.question_type_id,
      isCorrect: isAnswerCorrect,
      earnedPoint: Math.round(earnedPoint * 100) / 100,
      totalPoint: Number(q.point),
      studentAnswer: studentAnswerText,
      correctAnswer: correctAnswerText,
      explanation: q.explanation || null,
      feedback: feedbackMsg,
      vocabularyInfo: vocabCaptured ? {
        term: vocabCaptured.item.term,
        isDuplicate: vocabCaptured.isDuplicate,
        encounterCount: vocabCaptured.item.encounter_count,
        duplicateMessage: vocabCaptured.duplicateInfo?.message || null
      } : null,
      pairs: pairResults,
      pairFeedback: pairResults,
      pairResults: pairResults,
      matchingStats: q.question_type_id === 5 ? {
        totalPairs: optionRows.length,
        correctPairs: pairResults.filter(p => p.isPairMatch).length,
        incorrectPairs: optionRows.length - pairResults.filter(p => p.isPairMatch).length,
        accuracyPercent: optionRows.length > 0 ? Math.round((pairResults.filter(p => p.isPairMatch).length / optionRows.length) * 100) : 0
      } : undefined,

      options: optionRows.map((opt: any) => {
        const pr = pairResults.find(p => p.id === opt.id);
        return {
          id: opt.id,
          label: opt.option_label,
          text: opt.option_text,
          image: opt.option_image || null,
          isCorrect: q.question_type_id === 5 ? (pr ? pr.isPairMatch : false) : (opt.is_correct === 1 || opt.is_correct === true),
          isChosen: q.question_type_id === 2
            ? (Array.isArray(selectedOptionIds) && selectedOptionIds.map(Number).includes(opt.id))
            : Number(selectedOptionId) === opt.id,
          studentMatch: pr?.studentMatch || null,
          isPairMatch: pr?.isPairMatch ?? undefined,
          status: pr?.status ?? undefined,
          feedback: pr?.feedback ?? undefined,
          pairFeedback: pr?.feedback ?? undefined
        };
      })
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
