import { addXpTransaction } from './xp';

export const updateProgressHelper = async (
  connection: any,
  userId: number,
  lessonId: number,
  completed: boolean,
  progressPercent?: number
) => {
  const isCompleted = completed ? 1 : 0;
  const progressVal = progressPercent !== undefined ? progressPercent : (isCompleted ? 100.00 : 0.00);

  // 1. Update lesson progress
  const [existing]: any = await connection.query(
    'SELECT id, completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
    [userId, lessonId]
  );

  let awardXp = false;
  if (existing.length > 0) {
    const currentCompleted = existing[0].completed;
    if (isCompleted === 1 && currentCompleted === 0) {
      awardXp = true;
    }
    const completedAtSql = (isCompleted && !currentCompleted) ? ', completed_at = NOW()' : '';
    await connection.query(
      `UPDATE lesson_progress SET progress_percent = ?, completed = ? ${completedAtSql} WHERE user_id = ? AND lesson_id = ?`,
      [progressVal, isCompleted, userId, lessonId]
    );
  } else {
    if (isCompleted === 1) {
      awardXp = true;
    }
    const completedAtVal = isCompleted ? 'NOW()' : 'NULL';
    await connection.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, started_at, completed_at, progress_percent, completed) VALUES (?, ?, NOW(), ${completedAtVal}, ?, ?)`,
      [userId, lessonId, progressVal, isCompleted]
    );
  }

  if (awardXp) {
    await addXpTransaction(connection, userId, 'LESSON', 15, lessonId, `Completed Lesson #${lessonId}`);
    
    // Update learning statistics
    await connection.query(
      `INSERT INTO user_statistics (user_id, total_learning_minutes, total_video_minutes) 
       VALUES (?, 15, 15) 
       ON DUPLICATE KEY UPDATE 
       total_learning_minutes = total_learning_minutes + 15, 
       total_video_minutes = total_video_minutes + 15`,
      [userId]
    );
  }

  // 2. Fetch module_id of this lesson
  const [lessons]: any = await connection.query(
    'SELECT module_id FROM lessons WHERE id = ?',
    [lessonId]
  );
  if (lessons.length === 0) return;
  const moduleId = lessons[0].module_id;

  // 3. Recalculate Module Progress
  const [totalLessonsRows]: any = await connection.query(
    'SELECT COUNT(*) as count FROM lessons WHERE module_id = ? AND status = "PUBLISHED"',
    [moduleId]
  );
  const totalLessons = totalLessonsRows[0].count;

  const [completedLessonsRows]: any = await connection.query(
    `SELECT COUNT(*) as count 
     FROM lessons l 
     JOIN lesson_progress lp ON l.id = lp.lesson_id 
     WHERE l.module_id = ? AND lp.user_id = ? AND lp.completed = 1`,
    [moduleId, userId]
  );
  const completedLessons = completedLessonsRows[0].count;

  const moduleProgressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100.00 : 0.00;
  const moduleCompleted = moduleProgressPercent >= 100.00 ? 1 : 0;

  const [existingModProgress]: any = await connection.query(
    'SELECT id FROM module_progress WHERE user_id = ? AND module_id = ?',
    [userId, moduleId]
  );

  if (existingModProgress.length > 0) {
    await connection.query(
      'UPDATE module_progress SET completed_lesson = ?, total_lesson = ?, progress_percent = ?, completed = ? WHERE user_id = ? AND module_id = ?',
      [completedLessons, totalLessons, moduleProgressPercent, moduleCompleted, userId, moduleId]
    );
  } else {
    await connection.query(
      'INSERT INTO module_progress (user_id, module_id, completed_lesson, total_lesson, progress_percent, completed) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, moduleId, completedLessons, totalLessons, moduleProgressPercent, moduleCompleted]
    );
  }

  // 4. Recalculate Course Progress
  const [modules]: any = await connection.query(
    'SELECT course_version_id FROM modules WHERE id = ?',
    [moduleId]
  );
  if (modules.length === 0) return;
  const courseVersionId = modules[0].course_version_id;

  const [courseVersions]: any = await connection.query(
    'SELECT course_id FROM course_versions WHERE id = ?',
    [courseVersionId]
  );
  if (courseVersions.length === 0) return;
  const courseId = courseVersions[0].course_id;

  // Compute course overall progress based on total lessons in all modules rather than modules
  const [totalCourseLessonsRows]: any = await connection.query(
    `SELECT COUNT(l.id) as count 
     FROM lessons l
     JOIN modules m ON l.module_id = m.id
     WHERE m.course_version_id = ? AND l.status = "PUBLISHED" AND m.status = "PUBLISHED"`,
    [courseVersionId]
  );
  const totalCourseLessons = totalCourseLessonsRows[0].count;

  const [completedCourseLessonsRows]: any = await connection.query(
    `SELECT COUNT(l.id) as count 
     FROM lessons l
     JOIN modules m ON l.module_id = m.id
     JOIN lesson_progress lp ON l.id = lp.lesson_id
     WHERE m.course_version_id = ? AND lp.user_id = ? AND lp.completed = 1 AND l.status = "PUBLISHED" AND m.status = "PUBLISHED"`,
    [courseVersionId, userId]
  );
  const completedCourseLessons = completedCourseLessonsRows[0].count;

  const courseProgressPercent = totalCourseLessons > 0 ? (completedCourseLessons / totalCourseLessons) * 100.00 : 0.00;
  const courseFinishedAt = courseProgressPercent >= 100.00 ? 'NOW()' : 'NULL';
  const certificateReady = courseProgressPercent >= 100.00 ? 1 : 0;

  // Resolve completed & total modules for progress tracking fields
  const [totalModulesRows]: any = await connection.query(
    'SELECT COUNT(*) as count FROM modules WHERE course_version_id = ? AND status = "PUBLISHED"',
    [courseVersionId]
  );
  const totalModules = totalModulesRows[0].count;

  const [completedModulesRows]: any = await connection.query(
    `SELECT COUNT(*) as count 
     FROM modules m 
     JOIN module_progress mp ON m.id = mp.module_id 
     WHERE m.course_version_id = ? AND mp.user_id = ? AND mp.completed = 1`,
    [courseVersionId, userId]
  );
  const completedModules = completedModulesRows[0].count;

  await connection.query(
    `UPDATE course_progress 
     SET completed_module = ?, total_module = ?, overall_progress = ?, finished_at = ${courseFinishedAt}, certificate_ready = ?
     WHERE user_id = ? AND course_id = ?`,
    [completedModules, totalModules, courseProgressPercent, certificateReady, userId, courseId]
  );

  return {
    moduleId,
    completedLessons,
    totalLessons,
    moduleProgressPercent,
    courseId,
    courseProgressPercent,
    awardXp,
    completed: isCompleted === 1
  };
};

export const checkSequentialLessonLock = async (
  poolOrConn: any,
  userId: number,
  lessonId: number
): Promise<{ isLocked: boolean; requiredLessonId?: number; requiredLessonTitle?: string; currentLessonTitle?: string }> => {
  try {
    // 1. Fetch lesson and module info
    const [lessonRows]: any = await poolOrConn.query(
      `SELECT l.id, l.title, l.module_id, cv.id as course_version_id
       FROM lessons l
       JOIN modules m ON l.module_id = m.id
       JOIN course_versions cv ON m.course_version_id = cv.id
       WHERE l.id = ?`,
      [lessonId]
    );

    if (!lessonRows || lessonRows.length === 0) {
      return { isLocked: false };
    }

    const { title: currentLessonTitle, course_version_id } = lessonRows[0];

    // 2. Fetch all published lessons in this course version in chronological order
    const [allLessons]: any = await poolOrConn.query(
      `SELECT l.id, l.title, m.module_order, l.lesson_order,
              COALESCE(lp.completed, 0) as completed
       FROM lessons l
       JOIN modules m ON l.module_id = m.id
       LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ?
       WHERE m.course_version_id = ? AND m.status = 'PUBLISHED' AND l.status = 'PUBLISHED' AND l.deleted_at IS NULL
       ORDER BY m.module_order ASC, l.lesson_order ASC, l.id ASC`,
      [userId, course_version_id]
    );

    const targetIdx = allLessons.findIndex((cl: any) => cl.id === lessonId);
    if (targetIdx <= 0) {
      // First lesson in course is always unlocked
      return { isLocked: false, currentLessonTitle };
    }

    // Check if any prior lesson is not completed
    const priorIncomplete = allLessons.slice(0, targetIdx).find((cl: any) => !cl.completed);
    if (priorIncomplete) {
      return {
        isLocked: true,
        requiredLessonId: priorIncomplete.id,
        requiredLessonTitle: priorIncomplete.title,
        currentLessonTitle
      };
    }

    return { isLocked: false, currentLessonTitle };
  } catch (err) {
    console.error('Error in checkSequentialLessonLock:', err);
    return { isLocked: false };
  }
};
