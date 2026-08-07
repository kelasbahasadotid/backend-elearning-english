import { Request, Response } from 'express';
import pool from '../config/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';

// Helper to slugify strings (e.g. "English Beginner" -> "english-beginner")
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// ==========================================
// BANNERS CRUD
// ==========================================
export const getAllBanners = async (req: Request, res: Response) => {
  try {
    const [banners] = await pool.query<RowDataPacket[]>('SELECT * FROM banners ORDER BY id DESC');
    res.json(banners);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createBanner = async (req: Request, res: Response) => {
  const { title, imagePath, buttonText, buttonUrl, startDate, endDate, active } = req.body;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO banners (title, image_path, button_text, button_url, start_date, end_date, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, imagePath, buttonText, buttonUrl, startDate || null, endDate || null, active !== undefined ? active : 1]
    );
    res.status(201).json({ message: 'Banner created successfully', bannerId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateBanner = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, imagePath, buttonText, buttonUrl, startDate, endDate, active } = req.body;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE banners SET title = ?, image_path = ?, button_text = ?, button_url = ?, start_date = ?, end_date = ?, active = ? WHERE id = ?',
      [title, imagePath, buttonText, buttonUrl, startDate || null, endDate || null, active !== undefined ? active : 1, id]
    );
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Banner not found' });
       return;
    }
    res.json({ message: 'Banner updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteBanner = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM banners WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Banner not found' });
       return;
    }
    res.json({ message: 'Banner deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// COURSES CRUD
// ==========================================
export const getAllAdminCourses = async (req: Request, res: Response) => {
  try {
    const [courses] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, code, cefr_level, status, price, slug
       FROM courses
       ORDER BY id DESC`
    );
    res.json(courses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getLessonsByCourse = async (req: Request, res: Response) => {
  const { id } = req.params; // course_id
  try {
    const [versions] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM course_versions WHERE course_id = ? AND is_current = 1 LIMIT 1',
      [id]
    );

    if (versions.length === 0) {
      res.json([]);
      return;
    }

    const versionId = versions[0].id;

    const [lessons] = await pool.query<RowDataPacket[]>(
      `SELECT l.id, l.title, l.lesson_order, m.title AS module_title
       FROM lessons l
       JOIN modules m ON l.module_id = m.id
       WHERE m.course_version_id = ? AND l.deleted_at IS NULL
       ORDER BY m.module_order ASC, l.lesson_order ASC`,
      [versionId]
    );
    res.json(lessons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCourse = async (req: Request, res: Response) => {
  const {
    categoryId, category_id,
    levelId, level_id,
    createdBy, created_by,
    code,
    title,
    shortDescription, short_description,
    description,
    thumbnail,
    banner,
    cefrLevel, cefr_level,
    price,
    discountPrice, discount_price,
    status
  } = req.body;

  const slug = slugify(title);
  const finalCategoryId = categoryId ?? category_id ?? 1;
  const finalLevelId = levelId ?? level_id ?? 1;
  const finalCreatedBy = createdBy ?? created_by ?? 1;
  const finalShortDescription = shortDescription ?? short_description ?? null;
  const finalDescription = description ?? null;
  const finalCefrLevel = cefrLevel ?? cefr_level ?? 'A1';
  const finalPrice = price !== undefined ? price : 0;
  const finalDiscountPrice = discountPrice !== undefined ? discountPrice : (discount_price !== undefined ? discount_price : 0);

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO courses (category_id, level_id, created_by, code, title, slug, short_description, description, thumbnail, banner, cefr_level, price, discount_price, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalCategoryId, finalLevelId, finalCreatedBy, code, title, slug, finalShortDescription, finalDescription, thumbnail || null, banner || null, finalCefrLevel, finalPrice, finalDiscountPrice, status || 'DRAFT']
    );
    res.status(201).json({ message: 'Course created successfully', courseId: result.insertId, slug });
  } catch (error: any) {
    console.error('Create course failed:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateCourse = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    categoryId, category_id,
    levelId, level_id,
    code,
    title,
    shortDescription, short_description,
    description,
    thumbnail,
    banner,
    cefrLevel, cefr_level,
    price,
    discountPrice, discount_price,
    status
  } = req.body;
  
  try {
    const updates: string[] = [];
    const values: any[] = [];

    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };

    addUpdate('category_id', categoryId ?? category_id);
    addUpdate('level_id', levelId ?? level_id);
    addUpdate('code', code);
    addUpdate('title', title);
    if (title) {
      updates.push('slug = ?');
      values.push(slugify(title));
    }
    addUpdate('short_description', shortDescription ?? short_description);
    addUpdate('description', description);
    addUpdate('thumbnail', thumbnail);
    addUpdate('banner', banner);
    addUpdate('cefr_level', cefrLevel ?? cefr_level);
    addUpdate('price', price);
    addUpdate('discount_price', discountPrice ?? discount_price);
    addUpdate('status', status);

    if (updates.length === 0) {
       res.status(400).json({ error: 'No fields provided for update' });
       return;
    }

    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE courses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Course not found' });
       return;
    }
    res.json({ message: 'Course updated successfully' });
  } catch (error: any) {
    console.error('Update course failed:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteCourse = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM courses WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Course not found' });
       return;
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// CATEGORIES CRUD
// ==========================================
export const createCategory = async (req: Request, res: Response) => {
  const { name, description, icon, image, parentId } = req.body;
  const slug = slugify(name);
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO course_categories (parent_id, name, slug, description, icon, image) VALUES (?, ?, ?, ?, ?, ?)',
      [parentId || null, name, slug, description, icon, image]
    );
    res.status(201).json({ message: 'Category created successfully', categoryId: result.insertId, slug });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, icon, image, parentId, status } = req.body;
  try {
    const updates: string[] = [];
    const values: any[] = [];

    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };

    addUpdate('name', name);
    if (name) {
      updates.push('slug = ?');
      values.push(slugify(name));
    }
    addUpdate('description', description);
    addUpdate('icon', icon);
    addUpdate('image', image);
    addUpdate('parent_id', parentId);
    addUpdate('status', status);

    if (updates.length === 0) {
       res.status(400).json({ error: 'No fields provided for update' });
       return;
    }

    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE course_categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Category not found' });
       return;
    }
    res.json({ message: 'Category updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM course_categories WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Category not found' });
       return;
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// MODULES CRUD
// ==========================================
export const createModule = async (req: Request, res: Response) => {
  const { courseVersionId, title, description, moduleOrder, estimatedMinutes, status } = req.body;
  const slug = slugify(title);
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO modules (course_version_id, title, slug, description, module_order, estimated_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [courseVersionId || 1, title, slug, description, moduleOrder || 1, estimatedMinutes || 30, status || 'DRAFT']
    );
    res.status(201).json({ message: 'Module created successfully', moduleId: result.insertId, slug });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateModule = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, moduleOrder, estimatedMinutes, status } = req.body;
  try {
    const updates: string[] = [];
    const values: any[] = [];

    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };

    addUpdate('title', title);
    if (title) {
      updates.push('slug = ?');
      values.push(slugify(title));
    }
    addUpdate('description', description);
    addUpdate('module_order', moduleOrder);
    addUpdate('estimated_minutes', estimatedMinutes);
    addUpdate('status', status);

    if (updates.length === 0) {
       res.status(400).json({ error: 'No fields provided for update' });
       return;
    }

    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE modules SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Module not found' });
       return;
    }
    res.json({ message: 'Module updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteModule = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM modules WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Module not found' });
       return;
    }
    res.json({ message: 'Module deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// LESSONS CRUD
// ==========================================
export const createLesson = async (req: Request, res: Response) => {
  const {
    moduleId, module_id,
    lessonType, lesson_type,
    title,
    lessonOrder, lesson_order,
    durationMinutes, duration_minutes,
    isPreview, is_preview,
    isRequired, is_required,
    passingScore, passing_score,
    xpReward, xp_reward,
    maxAttempt, max_attempt,
    status
  } = req.body;

  const finalModuleId = moduleId ?? module_id;
  const finalLessonType = lessonType ?? lesson_type ?? 'VIDEO';
  const finalLessonOrder = lessonOrder ?? lesson_order ?? 1;
  const finalDuration = durationMinutes ?? duration_minutes ?? 0;
  const finalIsPreview = isPreview !== undefined ? (isPreview ? 1 : 0) : (is_preview ? 1 : 0);
  const finalIsRequired = isRequired !== undefined ? (isRequired ? 1 : 0) : (is_required ? 1 : 0);
  const finalPassingScore = passingScore ?? passing_score ?? 70;
  const finalXpReward = xpReward ?? xp_reward ?? 10;
  const finalMaxAttempt = maxAttempt !== undefined ? maxAttempt : (max_attempt !== undefined ? max_attempt : null);
  const finalStatus = status || 'DRAFT';

  const slug = slugify(title);
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO lessons (module_id, lesson_type, title, slug, lesson_order, duration_minutes, is_preview, is_required, passing_score, xp_reward, max_attempt, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalModuleId, finalLessonType, title, slug, finalLessonOrder, finalDuration, finalIsPreview, finalIsRequired, finalPassingScore, finalXpReward, finalMaxAttempt, finalStatus]
    );
    res.status(201).json({ message: 'Lesson created successfully', lessonId: result.insertId, slug });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateLesson = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title,
    lessonType, lesson_type,
    lessonOrder, lesson_order,
    durationMinutes, duration_minutes,
    isPreview, is_preview,
    isRequired, is_required,
    passingScore, passing_score,
    xpReward, xp_reward,
    maxAttempt, max_attempt,
    status
  } = req.body;

  const finalLessonType = lessonType ?? lesson_type;
  const finalLessonOrder = lessonOrder ?? lesson_order;
  const finalDuration = durationMinutes ?? duration_minutes;
  const finalPassingScore = passingScore ?? passing_score;
  const finalXpReward = xpReward ?? xp_reward;
  const finalMaxAttempt = maxAttempt !== undefined ? maxAttempt : max_attempt;
  const finalIsPreview = isPreview !== undefined ? (isPreview ? 1 : 0) : (is_preview !== undefined ? (is_preview ? 1 : 0) : undefined);
  const finalIsRequired = isRequired !== undefined ? (isRequired ? 1 : 0) : (is_required !== undefined ? (is_required ? 1 : 0) : undefined);

  try {
    const updates: string[] = [];
    const values: any[] = [];

    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };

    addUpdate('title', title);
    if (title) {
      updates.push('slug = ?');
      values.push(slugify(title));
    }
    addUpdate('lesson_type', finalLessonType);
    addUpdate('lesson_order', finalLessonOrder);
    addUpdate('duration_minutes', finalDuration);
    addUpdate('is_preview', finalIsPreview);
    addUpdate('is_required', finalIsRequired);
    addUpdate('passing_score', finalPassingScore);
    addUpdate('xp_reward', finalXpReward);
    addUpdate('max_attempt', finalMaxAttempt);
    addUpdate('status', status);

    if (updates.length > 0) {
      values.push(id);
      await pool.query<ResultSetHeader>(
        `UPDATE lessons SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Sync max_attempt & passing_score to child assessments table if exists
    if (finalMaxAttempt !== undefined || finalPassingScore !== undefined) {
      const updatesAssess: string[] = [];
      const valsAssess: any[] = [];
      if (finalMaxAttempt !== undefined) {
        updatesAssess.push('max_attempt = ?');
        valsAssess.push(finalMaxAttempt);
      }
      if (finalPassingScore !== undefined) {
        updatesAssess.push('passing_score = ?');
        valsAssess.push(finalPassingScore);
      }
      if (updatesAssess.length > 0) {
        valsAssess.push(id);
        await pool.query(
          `UPDATE assessments SET ${updatesAssess.join(', ')} WHERE lesson_id = ?`,
          valsAssess
        );
      }
    }

    res.json({ message: 'Lesson updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteLesson = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM lessons WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Lesson not found' });
       return;
    }
    res.json({ message: 'Lesson deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// QUIZZES (ASSESSMENTS) CRUD
// ==========================================
export const createQuiz = async (req: Request, res: Response) => {
  const { lessonId, moduleId, courseId, assessmentTypeId, title, description, instruction, passingScore, durationMinutes, totalQuestion, totalScore, maxAttempt, status } = req.body;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO assessments (lesson_id, module_id, course_id, assessment_type_id, title, description, instruction, passing_score, duration_minutes, total_question, total_score, max_attempt, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lessonId || null, moduleId || null, courseId || null, assessmentTypeId || 1, title, description, instruction, passingScore || 70, durationMinutes || 30, totalQuestion || 0, totalScore || 100, maxAttempt !== undefined ? maxAttempt : null, status || 'DRAFT']
    );
    res.status(201).json({ message: 'Quiz created successfully', quizId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateQuiz = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, instruction, passingScore, durationMinutes, totalQuestion, totalScore, maxAttempt, max_attempt, status } = req.body;
  const finalMaxAttempt = maxAttempt !== undefined ? maxAttempt : max_attempt;
  try {
    const updates: string[] = [];
    const values: any[] = [];

    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };

    addUpdate('title', title);
    addUpdate('description', description);
    addUpdate('instruction', instruction);
    addUpdate('passing_score', passingScore);
    addUpdate('duration_minutes', durationMinutes);
    addUpdate('total_question', totalQuestion);
    addUpdate('total_score', totalScore);
    addUpdate('max_attempt', finalMaxAttempt);
    addUpdate('status', status);

    if (updates.length > 0) {
      values.push(id);
      await pool.query<ResultSetHeader>(
        `UPDATE assessments SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    if (finalMaxAttempt !== undefined || passingScore !== undefined) {
      const updatesLesson: string[] = [];
      const valsLesson: any[] = [];
      if (finalMaxAttempt !== undefined) {
        updatesLesson.push('max_attempt = ?');
        valsLesson.push(finalMaxAttempt);
      }
      if (passingScore !== undefined) {
        updatesLesson.push('passing_score = ?');
        valsLesson.push(passingScore);
      }
      if (updatesLesson.length > 0) {
        valsLesson.push(id);
        await pool.query(
          `UPDATE lessons SET ${updatesLesson.join(', ')} WHERE id = (SELECT lesson_id FROM assessments WHERE id = ?)`,
          valsLesson
        );
      }
    }

    res.json({ message: 'Quiz updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteQuiz = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM assessments WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Quiz not found' });
       return;
    }
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// CERTIFICATE TEMPLATES CRUD
// ==========================================
export const createCertificateTemplate = async (req: Request, res: Response) => {
  const { templateCode, templateName, backgroundImage, orientation, paperSize, active, courseId } = req.body;
  try {
    if (courseId) {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id, template_name FROM certificate_templates WHERE course_id = ? LIMIT 1',
        [courseId]
      );
      if (existing.length > 0) {
        res.status(400).json({ error: `Kursus ini sudah terikat dengan templat sertifikat "${existing[0].template_name}". Satu kursus hanya boleh memiliki satu templat sertifikat.` });
        return;
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO certificate_templates (template_code, template_name, background_image, orientation, paper_size, active, course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [templateCode, templateName, backgroundImage, orientation || 'LANDSCAPE', paperSize || 'A4', active !== undefined ? active : 1, courseId || null]
    );
    res.status(201).json({ message: 'Certificate template created successfully', templateId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCertificateTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { templateCode, templateName, backgroundImage, orientation, paperSize, active, courseId } = req.body;
  try {
    if (courseId) {
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id, template_name FROM certificate_templates WHERE course_id = ? AND id != ? LIMIT 1',
        [courseId, id]
      );
      if (existing.length > 0) {
        res.status(400).json({ error: `Kursus ini sudah terikat dengan templat sertifikat "${existing[0].template_name}". Satu kursus hanya boleh memiliki satu templat sertifikat.` });
        return;
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };

    addUpdate('template_code', templateCode);
    addUpdate('template_name', templateName);
    addUpdate('background_image', backgroundImage);
    addUpdate('orientation', orientation);
    addUpdate('paper_size', paperSize);
    addUpdate('active', active);
    addUpdate('course_id', courseId);

    if (updates.length === 0) {
       res.status(400).json({ error: 'No fields provided for update' });
       return;
    }

    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE certificate_templates SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Certificate template not found' });
       return;
    }
    res.json({ message: 'Certificate template updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCertificateTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM certificate_templates WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Certificate template not found' });
       return;
    }
    res.json({ message: 'Certificate template deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// ADDITIONAL GET LISTINGS FOR COMPLETING CRUD
// ==========================================
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const [categories] = await pool.query<RowDataPacket[]>('SELECT * FROM course_categories ORDER BY id DESC');
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllModules = async (req: Request, res: Response) => {
  try {
    const [modules] = await pool.query<RowDataPacket[]>('SELECT * FROM modules ORDER BY module_order ASC');
    res.json(modules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllLessons = async (req: Request, res: Response) => {
  try {
    const [lessons] = await pool.query<RowDataPacket[]>('SELECT * FROM lessons ORDER BY lesson_order ASC');
    res.json(lessons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllQuizzes = async (req: Request, res: Response) => {
  try {
    const [quizzes] = await pool.query<RowDataPacket[]>(
      `SELECT a.*, c.title AS course_title, c.code AS course_code 
       FROM assessments a
       LEFT JOIN courses c ON a.course_id = c.id
       ORDER BY a.id DESC`
    );
    res.json(quizzes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllCertificateTemplates = async (req: Request, res: Response) => {
  try {
    const [templates] = await pool.query<RowDataPacket[]>('SELECT * FROM certificate_templates ORDER BY id DESC');
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// USER MANAGEMENT CRUD (SUPER ADMIN & ADMIN ONLY)
// ==========================================
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, role_id, full_name, email, username, phone, status, created_at FROM users ORDER BY id DESC'
    );
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { roleId, fullName, email, username, password, phone, status } = req.body;
  try {
    const passwordHash = await bcrypt.hash(password || 'Password123', 10);
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (role_id, full_name, email, username, password, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roleId || 4, fullName, email, username, passwordHash, phone || null, status || 'ACTIVE']
    );
    // Auto insert default empty profile record for the user
    await pool.query('INSERT INTO user_profiles (user_id) VALUES (?)', [result.insertId]);
    
    // Auto insert statistics row
    await pool.query('INSERT INTO user_statistics (user_id, xp, level) VALUES (?, 0, 1)', [result.insertId]);
    
    res.status(201).json({ message: 'User created successfully', userId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { roleId, fullName, email, username, password, phone, status } = req.body;
  try {
    const updates: string[] = [];
    const values: any[] = [];
    
    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };
    
    addUpdate('role_id', roleId);
    addUpdate('full_name', fullName);
    addUpdate('email', email);
    addUpdate('username', username);
    addUpdate('phone', phone);
    addUpdate('status', status);
    
    if (password) {
      updates.push('password = ?');
      values.push(await bcrypt.hash(password, 10));
    }
    
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields provided for update' });
      return;
    }
    
    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'User not found' });
       return;
    }
    res.json({ message: 'User updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'User not found' });
       return;
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// QUIZ QUESTIONS CRUD
// ==========================================
export const getQuizQuestions = async (req: Request, res: Response) => {
  const { quizId } = req.params; // assessment_id
  try {
    // 1. Fetch sections
    const [sections] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM assessment_sections WHERE assessment_id = ? ORDER BY section_order ASC',
      [quizId]
    );

    if (sections.length === 0) {
      res.json([]);
      return;
    }

    const sectionIds = sections.map(s => s.id);

    // 2. Fetch questions
    const [questions] = await pool.query<RowDataPacket[]>(
      `SELECT id, assessment_section_id, question_type_id, question_code, question_text, explanation, point, question_order, status 
       FROM questions 
       WHERE assessment_section_id IN (${sectionIds.map(() => '?').join(',')}) AND status = 'ACTIVE' 
       ORDER BY question_order ASC`,
      sectionIds
    );

    if (questions.length === 0) {
      res.json([]);
      return;
    }

    const questionIds = questions.map(q => q.id);

    // 3. Fetch options (include is_correct and score for admin editing)
    const [options] = await pool.query<RowDataPacket[]>(
      `SELECT id, question_id, option_label, option_text, is_correct, score, option_order 
       FROM question_options 
       WHERE question_id IN (${questionIds.map(() => '?').join(',')}) 
       ORDER BY option_order ASC`,
      questionIds
    );

    // Attach options to questions
    const questionsWithOptions = questions.map((q: any) => ({
      ...q,
      options: options.filter(o => o.question_id === q.id)
    }));

    res.json(questionsWithOptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createQuizQuestion = async (req: Request, res: Response) => {
  const { quizId } = req.params; // assessment_id
  const { questionTypeId, questionCode, questionText, explanation, point, questionOrder, status } = req.body;
  try {
    // Check if assessment section exists for this quiz, otherwise create default section
    let [sections] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM assessment_sections WHERE assessment_id = ? LIMIT 1',
      [quizId]
    );
    let sectionId;
    if (sections.length > 0) {
      sectionId = sections[0].id;
    } else {
      const [secRes] = await pool.query<ResultSetHeader>(
        'INSERT INTO assessment_sections (assessment_id, title, section_order) VALUES (?, "Default Section", 1)',
        [quizId]
      );
      sectionId = secRes.insertId;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO questions (assessment_section_id, question_type_id, question_code, question_text, explanation, point, question_order, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sectionId, questionTypeId || 1, questionCode || 'Q_CODE', questionText, explanation || '', point || 10.00, questionOrder || 1, status || 'ACTIVE']
    );
    
    res.status(201).json({ message: 'Quiz question created successfully', questionId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateQuizQuestion = async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const { questionTypeId, questionCode, questionText, explanation, point, questionOrder, status } = req.body;
  try {
    const updates: string[] = [];
    const values: any[] = [];
    
    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };
    
    addUpdate('question_type_id', questionTypeId);
    addUpdate('question_code', questionCode);
    addUpdate('question_text', questionText);
    addUpdate('explanation', explanation);
    addUpdate('point', point);
    addUpdate('question_order', questionOrder);
    addUpdate('status', status);
    
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields provided for update' });
      return;
    }
    
    values.push(questionId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE questions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Question not found' });
       return;
    }
    res.json({ message: 'Quiz question updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteQuizQuestion = async (req: Request, res: Response) => {
  const { questionId } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM questions WHERE id = ?', [questionId]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Question not found' });
       return;
    }
    res.json({ message: 'Quiz question deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// QUIZ QUESTION OPTIONS CRUD
// ==========================================
export const createQuestionOption = async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const { optionLabel, optionText, isCorrect, score, optionOrder } = req.body;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO question_options (question_id, option_label, option_text, is_correct, score, option_order) VALUES (?, ?, ?, ?, ?, ?)',
      [questionId, optionLabel || 'A', optionText, isCorrect ? 1 : 0, score || 0.00, optionOrder || 1]
    );
    res.status(201).json({ message: 'Question option created successfully', optionId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateQuestionOption = async (req: Request, res: Response) => {
  const { optionId } = req.params;
  const { optionLabel, optionText, isCorrect, score, optionOrder } = req.body;
  try {
    const updates: string[] = [];
    const values: any[] = [];
    
    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };
    
    addUpdate('option_label', optionLabel);
    addUpdate('option_text', optionText);
    addUpdate('is_correct', isCorrect !== undefined ? (isCorrect ? 1 : 0) : undefined);
    addUpdate('score', score);
    addUpdate('option_order', optionOrder);
    
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields provided for update' });
      return;
    }
    
    values.push(optionId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE question_options SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Option not found' });
       return;
    }
    res.json({ message: 'Question option updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteQuestionOption = async (req: Request, res: Response) => {
  const { optionId } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM question_options WHERE id = ?', [optionId]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Option not found' });
       return;
    }
    res.json({ message: 'Question option deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// SPEAKING TESTS & PROMPTS CRUD
// ==========================================
export const getAllSpeakingTests = async (req: Request, res: Response) => {
  try {
    const [tests] = await pool.query<RowDataPacket[]>(
      `SELECT st.*, c.title AS course_title, a.lesson_id AS lesson_id, a.passing_score, a.max_attempt
       FROM speaking_tests st
       LEFT JOIN assessments a ON st.assessment_id = a.id
       LEFT JOIN courses c ON a.course_id = c.id
       ORDER BY st.id DESC`
    );
    res.json(tests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSpeakingTest = async (req: Request, res: Response) => {
  const { assessmentId, title, instruction, minimumDuration, maximumDuration, allowRerecord, maxRecording } = req.body;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO speaking_tests (assessment_id, title, instruction, minimum_duration, maximum_duration, allow_rerecord, max_recording) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [assessmentId, title, instruction, minimumDuration || 15, maximumDuration || 120, allowRerecord !== undefined ? allowRerecord : 1, maxRecording || 3]
    );
    res.status(201).json({ message: 'Speaking test created successfully', speakingTestId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSpeakingTest = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, instruction, minimumDuration, maximumDuration, allowRerecord, maxRecording, maxAttempt, passingScore } = req.body;
  try {
    const updates: string[] = [];
    const values: any[] = [];
    
    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };
    
    addUpdate('title', title);
    addUpdate('instruction', instruction);
    addUpdate('minimum_duration', minimumDuration);
    addUpdate('maximum_duration', maximumDuration);
    addUpdate('allow_rerecord', allowRerecord);
    addUpdate('max_recording', maxRecording);
    
    if (updates.length > 0) {
      values.push(id);
      await pool.query<ResultSetHeader>(
        `UPDATE speaking_tests SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Sync maxAttempt and passingScore to parent assessment & lesson tables
    if (maxAttempt !== undefined || passingScore !== undefined) {
      const [testRows] = await pool.query<RowDataPacket[]>(
        'SELECT assessment_id FROM speaking_tests WHERE id = ?',
        [id]
      );
      if (testRows.length > 0 && testRows[0].assessment_id) {
        const assessId = testRows[0].assessment_id;
        const assessUpdates: string[] = [];
        const assessVals: any[] = [];
        if (maxAttempt !== undefined) {
          assessUpdates.push('max_attempt = ?');
          assessVals.push(maxAttempt);
        }
        if (passingScore !== undefined) {
          assessUpdates.push('passing_score = ?');
          assessVals.push(passingScore);
        }
        if (assessUpdates.length > 0) {
          assessVals.push(assessId);
          await pool.query(
            `UPDATE assessments SET ${assessUpdates.join(', ')} WHERE id = ?`,
            assessVals
          );
          // Also sync to parent lesson
          await pool.query(
            `UPDATE lessons SET max_attempt = ? WHERE id = (SELECT lesson_id FROM assessments WHERE id = ?)`,
            [maxAttempt !== undefined ? maxAttempt : null, assessId]
          );
        }
      }
    }
    
    res.json({ message: 'Speaking test updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSpeakingTest = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM speaking_tests WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Speaking test not found' });
       return;
    }
    res.json({ message: 'Speaking test deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSpeakingPrompt = async (req: Request, res: Response) => {
  const { testId } = req.params; // speaking_test_id
  const { promptType, promptText, imageUrl, audioUrl, promptOrder } = req.body;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO speaking_prompts (speaking_test_id, prompt_type, prompt_text, image_url, audio_url, prompt_order) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [testId, promptType || 'READING', promptText, imageUrl || null, audioUrl || null, promptOrder || 1]
    );
    res.status(201).json({ message: 'Speaking prompt created successfully', promptId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSpeakingPrompt = async (req: Request, res: Response) => {
  const { promptId } = req.params;
  const { promptType, promptText, imageUrl, audioUrl, promptOrder } = req.body;
  try {
    const updates: string[] = [];
    const values: any[] = [];
    
    const addUpdate = (col: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${col} = ?`);
        values.push(val);
      }
    };
    
    addUpdate('prompt_type', promptType);
    addUpdate('prompt_text', promptText);
    addUpdate('image_url', imageUrl);
    addUpdate('audio_url', audioUrl);
    addUpdate('prompt_order', promptOrder);
    
    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields provided for update' });
      return;
    }
    
    values.push(promptId);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE speaking_prompts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Speaking prompt not found' });
       return;
    }
    res.json({ message: 'Speaking prompt updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSpeakingPrompt = async (req: Request, res: Response) => {
  const { promptId } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM speaking_prompts WHERE id = ?', [promptId]);
    if (result.affectedRows === 0) {
       res.status(404).json({ error: 'Speaking prompt not found' });
       return;
    }
    res.json({ message: 'Speaking prompt deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// ORDER / PURCHASE MANAGEMENT CRUD
// ==========================================
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const [orders] = await pool.query<RowDataPacket[]>(
      `SELECT o.id, o.order_number, o.user_id, o.subtotal, o.discount, o.tax, o.grand_total, o.payment_status, o.order_status, o.created_at,
              u.full_name as studentName, u.email as studentEmail,
              GROUP_CONCAT(c.title SEPARATOR ', ') as courseNames,
              IF(so.id IS NOT NULL, 1, 0) as isScalev,
              so.external_order_id as scalevExternalId,
              so.sync_status as scalevSyncStatus,
              so.synced_at as scalevSyncedAt
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN courses c ON oi.course_id = c.id
       LEFT JOIN scalev_orders so ON o.id = so.order_id
       GROUP BY o.id
       ORDER BY o.id DESC`
    );
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { orderStatus, paymentStatus } = req.body;
  
  // Custom AuthRequest interface helper
  const authReq = req as AuthRequest;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query<RowDataPacket[]>(
      'SELECT id, user_id, grand_total, payment_status, order_status FROM orders WHERE id = ?',
      [id]
    );

    if (orders.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orders[0];
    const previousStatus = order.order_status;

    const updates: string[] = [];
    const values: any[] = [];
    if (orderStatus !== undefined) {
      updates.push('order_status = ?');
      values.push(orderStatus);
    }
    if (paymentStatus !== undefined) {
      updates.push('payment_status = ?');
      values.push(paymentStatus);
    }

    if (updates.length > 0) {
      values.push(id);
      await connection.query(
        `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    if (orderStatus === 'SUCCESS' && previousStatus !== 'SUCCESS') {
      const [existingPayments] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM payments WHERE order_id = ?',
        [id]
      );
      
      let paymentId;
      if (existingPayments.length === 0) {
        const extTxId = `MANUAL-TX-${Date.now()}`;
        const [payRes] = await connection.query<ResultSetHeader>(
          'INSERT INTO payments (order_id, payment_method_id, external_transaction_id, amount, paid_at, status) VALUES (?, ?, ?, ?, NOW(), ?)',
          [id, 1, extTxId, order.grand_total, 'SUCCESS']
        );
        paymentId = payRes.insertId;
        
        await connection.query(
          'INSERT INTO payment_transactions (payment_id, gateway_name, gateway_reference, request_payload, response_payload) VALUES (?, ?, ?, ?, ?)',
          [paymentId, 'MANUAL', extTxId, '{"method": "admin_manual"}', '{"status": "SUCCESS"}']
        );
      }

      const [orderItems] = await connection.query<RowDataPacket[]>(
        'SELECT course_id FROM order_items WHERE order_id = ?',
        [id]
      );

      if (orderItems.length > 0) {
        const courseId = orderItems[0].course_id;

        const [existingEnrollment] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'ACTIVE'",
          [order.user_id, courseId]
        );

        if (existingEnrollment.length === 0) {
          const [courses] = await connection.query<RowDataPacket[]>(
            'SELECT access_days FROM courses WHERE id = ?',
            [courseId]
          );
          const accessDays = courses.length > 0 ? courses[0].access_days : 365;

          const [enrollResult] = await connection.query<ResultSetHeader>(
            'INSERT INTO enrollments (user_id, course_id, source_id, order_id, enrolled_at, expired_at, access_days, status) VALUES (?, ?, 1, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?)',
            [order.user_id, courseId, id, accessDays, accessDays, 'ACTIVE']
          );

          await connection.query(
            "INSERT INTO enrollment_histories (enrollment_id, action, description, created_by) VALUES (?, 'CREATE', 'Manual activation by administrator', ?)",
            [enrollResult.insertId, authReq.user?.id || 1]
          );

          await connection.query(
            'INSERT INTO course_progress (user_id, course_id, enrollment_id, completed_module, total_module, overall_progress, average_score) VALUES (?, ?, ?, 0, 1, 0.00, 0.00)',
            [order.user_id, courseId, enrollResult.insertId]
          );
        }
      }
    }

    await connection.commit();
    res.json({ message: 'Order status updated successfully' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

/**
 * Bulk Import Scalev Orders (For syncing existing past transactions from Scalev)
 */
export const importScalevOrders = async (req: Request, res: Response) => {
  const { orders } = req.body;
  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    res.status(400).json({ error: 'Array of orders is required' });
    return;
  }

  const { processScalevWebhook } = require('./paymentController');
  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (const item of orders) {
    try {
      const mockReq = { body: item, headers: {} } as any;

      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            skippedCount++;
            errors.push(`Order ${item.id || item.email || item.customer?.email || 'unknown'}: ${data.error || data.message || 'Error'}`);
          }
        }),
        json: (data: any) => {
          if (data.success || data.message?.includes('processed') || data.message?.includes('active')) {
            importedCount++;
          } else {
            skippedCount++;
            if (data.message) {
              errors.push(`Order ${item.id || item.email || item.customer?.email || 'unknown'}: ${data.message}`);
            }
          }
        }
      } as any;

      await processScalevWebhook(mockReq, mockRes);
    } catch (err: any) {
      skippedCount++;
      errors.push(`Order ${item.id || item.email || 'unknown'}: ${err.message}`);
    }
  }

  res.json({
    success: importedCount > 0,
    message: `Scalev import complete. ${importedCount} student accounts & course enrollments active, ${skippedCount} skipped/duplicates.`,
    importedCount,
    skippedCount,
    errors
  });
};

// Scalev Dynamic Packages Management
export const ensureScalevPackagesTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scalev_packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        package_name VARCHAR(255) NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        access_days INT NOT NULL DEFAULT 365,
        duration_label VARCHAR(100) NOT NULL DEFAULT '1 Tahun',
        status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM scalev_packages');
    if (rows[0]?.count === 0) {
      await pool.query(`
        INSERT INTO scalev_packages (package_name, keyword, access_days, duration_label, status) VALUES
        ('Paket 1 E-learning + TOEFL', 'paket 1, paket1, 3 bulan, 3-bulan, 3m', 90, '3 Bulan', 'ACTIVE'),
        ('Paket 2 E-learning + TOEFL Fastrack', 'paket 2, paket2, 6 bulan, 6-bulan, fastrack, 6m', 180, '6 Bulan', 'ACTIVE'),
        ('Paket 3 E-learning + TOEFL + Modul', 'paket 3, paket3, 1 tahun, 12 bulan, 1-tahun, 1y', 365, '1 Tahun', 'ACTIVE')
      `);
    }
  } catch (err) {
    console.error('Error ensuring scalev_packages table:', err);
  }
};

// Ensure table is created when module loads
ensureScalevPackagesTable();

export const getScalevPackages = async (req: Request, res: Response) => {
  try {
    await ensureScalevPackagesTable();
    const [packages] = await pool.query<RowDataPacket[]>('SELECT * FROM scalev_packages ORDER BY id ASC');
    res.json(packages);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch scalev packages' });
  }
};

export const createScalevPackage = async (req: Request, res: Response) => {
  const { packageName, keyword, accessDays, durationLabel, status } = req.body;
  if (!packageName || !keyword || !accessDays) {
    res.status(400).json({ error: 'Package Name, Keyword, and Access Days are required' });
    return;
  }
  try {
    await ensureScalevPackagesTable();
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO scalev_packages (package_name, keyword, access_days, duration_label, status) VALUES (?, ?, ?, ?, ?)',
      [packageName.trim(), keyword.trim(), Number(accessDays) || 365, durationLabel || `${accessDays} Hari`, status || 'ACTIVE']
    );
    res.status(201).json({ message: 'Scalev package created successfully', id: result.insertId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create scalev package' });
  }
};

export const updateScalevPackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { packageName, keyword, accessDays, durationLabel, status } = req.body;
  try {
    await ensureScalevPackagesTable();
    await pool.query(
      'UPDATE scalev_packages SET package_name = ?, keyword = ?, access_days = ?, duration_label = ?, status = ? WHERE id = ?',
      [packageName.trim(), keyword.trim(), Number(accessDays) || 365, durationLabel || `${accessDays} Hari`, status || 'ACTIVE', id]
    );
    res.json({ message: 'Scalev package updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update scalev package' });
  }
};

export const deleteScalevPackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM scalev_packages WHERE id = ?', [id]);
    res.json({ message: 'Scalev package deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete scalev package' });
  }
};

// Course Status Approval
export const updateCourseStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query(
      'UPDATE courses SET status = ? WHERE id = ?',
      [status, id]
    );
    res.json({ message: 'Course status updated successfully', status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Tags Taxonomy CRUD
export const getAllTags = async (req: Request, res: Response) => {
  try {
    const [tags] = await pool.query<RowDataPacket[]>('SELECT * FROM course_tags ORDER BY id DESC');
    res.json(tags);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createTag = async (req: Request, res: Response) => {
  const { name } = req.body;
  const slug = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO course_tags (name, slug) VALUES (?, ?)',
      [name, slug]
    );
    res.status(201).json({ message: 'Tag created successfully', tagId: result.insertId, slug });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTag = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  const slug = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  try {
    await pool.query(
      'UPDATE course_tags SET name = ?, slug = ? WHERE id = ?',
      [name, slug, id]
    );
    res.json({ message: 'Tag updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTag = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM course_tags WHERE id = ?', [id]);
    res.json({ message: 'Tag deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Helper to ensure system_settings table exists and default settings are seeded
const ensureSettingsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT NULL,
        value_type VARCHAR(20) DEFAULT 'STRING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const defaultDefaults: [string, string][] = [
      ['site_title', 'Global English'],
      ['site_tagline', 'Platform Pembelajaran Bahasa Inggris Interaktif & Terstruktur'],
      ['site_description', 'Platform kursus bahasa Inggris online terpercaya dengan silabus terstruktur standar CEFR, latihan AI Speaking, kuis CBT, dan sertifikat resmi.'],
      ['meta_keywords', 'kursus bahasa inggris, e-learning inggris, belajar tenses, speaking test ai, cbt exam, sertifikat inggris, global english'],
      ['meta_author', 'Global English Team'],
      ['meta_og_image', '/uploads/banners/og_preview.png'],
      ['footer_about_text', 'Global English adalah platform e-learning terdepan untuk meningkatkan kemampuan bahasa Inggris siswa dengan metode modern, evaluasi pengucapan AI, dan silabus CEFR.'],
      ['footer_copyright', '© 2026 Global English. Hak Cipta Dilindungi Undang-Undang.'],
      ['footer_contact_email', 'support@globalenglish.id'],
      ['footer_contact_phone', '+62 812-3456-7890'],
      ['footer_address', 'Jl. Kampung Inggris No. 88, Pare, Kediri, Jawa Timur'],
      ['footer_social_facebook', 'https://facebook.com/globalenglish'],
      ['footer_social_instagram', 'https://instagram.com/globalenglish'],
      ['footer_social_youtube', 'https://youtube.com/globalenglish'],
      ['footer_social_linkedin', 'https://linkedin.com/company/globalenglish'],
      ['currency', 'IDR'],
      ['tax_percentage', '0'],
      ['support_email', 'support@globalenglish.id']
    ];

    for (const [key, val] of defaultDefaults) {
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value, value_type) 
         VALUES (?, ?, 'STRING') 
         ON DUPLICATE KEY UPDATE id=id`,
        [key, val]
      );
    }
  } catch (err) {
    console.error('Failed to ensure system_settings table:', err);
  }
};

// Settings General Configurations
export const getPublicSettings = async (req: Request, res: Response) => {
  try {
    await ensureSettingsTable();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT setting_key, setting_value FROM system_settings');
    const settingsMap: Record<string, string> = {};
    rows.forEach(r => {
      if (r.setting_value !== undefined && r.setting_value !== null) {
        settingsMap[r.setting_key] = r.setting_value;
      }
    });
    res.json(settingsMap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    await ensureSettingsTable();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT setting_key, setting_value FROM system_settings');
    const settingsMap: Record<string, string> = {};
    rows.forEach(r => {
      settingsMap[r.setting_key] = r.setting_value;
    });
    res.json(settingsMap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  const settings = req.body;
  try {
    await ensureSettingsTable();
    for (const [key, val] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value, value_type)
         VALUES (?, ?, 'STRING')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, val !== null && val !== undefined ? String(val) : '']
      );
    }
    res.json({ message: 'Settings updated successfully' });
  } catch (error: any) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: error.message || 'Gagal menyimpan pengaturan' });
  }
};

// Users Management Bulk Action
export const bulkUserAction = async (req: Request, res: Response) => {
  const { userIds, action, value } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({ error: 'No user IDs provided' });
    return;
  }
  try {
    if (action === 'delete') {
      await pool.query('DELETE FROM users WHERE id IN (?)', [userIds]);
      res.json({ message: `Successfully deleted ${userIds.length} users` });
    } else if (action === 'status') {
      await pool.query('UPDATE users SET status = ? WHERE id IN (?)', [value || 'ACTIVE', userIds]);
      res.json({ message: `Successfully updated status to ${value} for ${userIds.length} users` });
    } else {
      res.status(400).json({ error: 'Invalid bulk action' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAdminAnalytics = async (req: Request, res: Response) => {
  try {
    const [salesOverview] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, CAST(SUM(grand_total) AS DOUBLE) as totalRevenue 
       FROM orders 
       WHERE payment_status = 'PAID' 
       GROUP BY month 
       ORDER BY month ASC 
       LIMIT 12`
    );

    const [courseEnrollments] = await pool.query<RowDataPacket[]>(
      `SELECT c.title as courseTitle, COUNT(e.id) as studentCount 
       FROM enrollments e 
       JOIN courses c ON e.course_id = c.id 
       GROUP BY c.id 
       ORDER BY studentCount DESC`
    );

    const [roleDistribution] = await pool.query<RowDataPacket[]>(
      `SELECT r.name as roleName, COUNT(u.id) as userCount 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       GROUP BY r.id`
    );

    const [monthlyRegistrations] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(id) as studentCount 
       FROM users 
       WHERE role_id = 4 
       GROUP BY month 
       ORDER BY month ASC 
       LIMIT 12`
    );

    const [completionRateRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(e.id) as total,
        COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) as enrolled,
        COUNT(CASE WHEN e.status = 'ACTIVE' AND (cp.certificate_ready = 1 OR cp.overall_progress >= 100) THEN 1 END) as completed,
        COUNT(CASE WHEN e.status = 'ACTIVE' AND cp.overall_progress > 0 AND cp.overall_progress < 100 THEN 1 END) as inProgress,
        COUNT(CASE WHEN e.status = 'ACTIVE' AND (cp.overall_progress IS NULL OR cp.overall_progress = 0) THEN 1 END) as inactive,
        COUNT(CASE WHEN e.status = 'CANCELLED' OR e.status = 'EXPIRED' THEN 1 END) as cancelled
       FROM enrollments e
       LEFT JOIN course_progress cp ON e.user_id = cp.user_id AND e.course_id = cp.course_id`
    );

    res.json({
      salesOverview,
      courseEnrollments,
      roleDistribution,
      monthlyRegistrations,
      completionRate: completionRateRows[0] || { total: 0, enrolled: 0, completed: 0, inProgress: 0, inactive: 0, cancelled: 0 }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// LESSON CONTENT MANAGEMENT (with base64 file attachments)
// ═══════════════════════════════════════════════════════════

/** GET /admin/lessons/:lessonId/contents */
export const getLessonContents = async (req: Request, res: Response) => {
  const { lessonId } = req.params;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, lesson_id, content_type, title, description, content_order, is_required, estimated_minutes, status, created_at,
              CASE WHEN attachments IS NOT NULL THEN JSON_LENGTH(attachments) ELSE 0 END AS attachment_count,
              attachments
       FROM lesson_contents WHERE lesson_id = ? ORDER BY content_order ASC`,
      [lessonId]
    );
    // Send attachments metadata only (strip base64 data) in list view
    const safeRows = (rows as any[]).map((row: any) => {
      let meta: any[] = [];
      if (row.attachments) {
        try {
          meta = (JSON.parse(row.attachments) as any[]).map((a: any) => ({
            id: a.id, name: a.name, mime: a.mime, type: a.type, size: a.size
          }));
        } catch (_) {}
      }
      return { ...row, attachments: meta };
    });
    res.json({ contents: safeRows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** GET /admin/lessons/contents/:id/attachments — full base64 data */
export const getLessonContentAttachments = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, attachments FROM lesson_contents WHERE id = ?', [id]
    );
    if ((rows as any[]).length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const attachments = (rows as any[])[0].attachments
      ? JSON.parse((rows as any[])[0].attachments) : [];
    res.json({ attachments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** POST /admin/lessons/:lessonId/contents */
export const createLessonContent = async (req: Request, res: Response) => {
  const { lessonId } = req.params;
  const {
    title, description, contentType = 'READING',
    contentOrder = 1, isRequired = false,
    estimatedMinutes = 5, status = 'ACTIVE',
    attachments = []
  } = req.body;

  if (!title) { res.status(400).json({ error: 'title is required' }); return; }

  const MAX = 10 * 1024 * 1024 * 1.37;
  for (const att of attachments) {
    if (att.data && att.data.length > MAX) {
      res.status(413).json({ error: `File "${att.name}" exceeds 10MB limit` }); return;
    }
  }

  const withIds = (attachments as any[]).map((att: any, i: number) => ({
    id: `att_${Date.now()}_${i}`,
    name: att.name, mime: att.mime,
    type: att.type, size: att.size, data: att.data
  }));

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO lesson_contents (lesson_id, content_type, title, description, content_order, is_required, estimated_minutes, status, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lessonId, contentType, title, description || null, contentOrder,
       isRequired ? 1 : 0, estimatedMinutes, status,
       withIds.length > 0 ? JSON.stringify(withIds) : null]
    );
    res.status(201).json({ message: 'Lesson content created', contentId: result.insertId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** PUT /admin/lessons/contents/:id */
export const updateLessonContent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, contentType, contentOrder,
          isRequired, estimatedMinutes, status, attachments } = req.body;
  try {
    const updates: string[] = [];
    const values: any[] = [];
    const add = (col: string, val: any) => {
      if (val !== undefined) { updates.push(`${col} = ?`); values.push(val); }
    };
    add('title', title);
    add('description', description ?? null);
    add('content_type', contentType);
    add('content_order', contentOrder);
    add('is_required', isRequired !== undefined ? (isRequired ? 1 : 0) : undefined);
    add('estimated_minutes', estimatedMinutes);
    add('status', status);

    if (attachments !== undefined) {
      if (Array.isArray(attachments) && attachments.length > 0) {
        const withIds = (attachments as any[]).map((att: any, i: number) => ({
          id: att.id || `att_${Date.now()}_${i}`,
          name: att.name, mime: att.mime, type: att.type, size: att.size, data: att.data
        }));
        updates.push('attachments = ?');
        values.push(JSON.stringify(withIds));
      } else {
        updates.push('attachments = NULL');
      }
    }

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE lesson_contents SET ${updates.join(', ')} WHERE id = ?`, values
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ message: 'Lesson content updated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** DELETE /admin/lessons/contents/:id */
export const deleteLessonContent = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM lesson_contents WHERE id = ?', [id]);
    if (result.affectedRows === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ message: 'Lesson content deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// QUESTION & OPTION IMAGE UPLOAD
// ═══════════════════════════════════════════════════════════

/** PUT /admin/quizzes/questions/:questionId/image */
export const updateQuestionImage = async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const { imageData } = req.body;
  try {
    if (imageData && imageData.length > 50 * 1024 * 1024 * 1.37) {
      res.status(413).json({ error: 'Image exceeds 50MB limit' }); return;
    }
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE questions SET question_image = ? WHERE id = ?', [imageData || null, questionId]
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: 'Question not found' }); return; }
    res.json({ message: imageData ? 'Question image uploaded' : 'Question image removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** PUT /admin/quizzes/questions/options/:optionId/image */
export const updateQuestionOptionImage = async (req: Request, res: Response) => {
  const { optionId } = req.params;
  const { imageData } = req.body;
  try {
    if (imageData && imageData.length > 50 * 1024 * 1024 * 1.37) {
      res.status(413).json({ error: 'Image exceeds 50MB limit' }); return;
    }
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE question_options SET option_image = ? WHERE id = ?', [imageData || null, optionId]
    );
    if (result.affectedRows === 0) { res.status(404).json({ error: 'Option not found' }); return; }
    res.json({ message: imageData ? 'Option image uploaded' : 'Option image removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/admin/convert-pptx
 * Converts a PPTX presentation to a high-fidelity PDF presentation using LibreOffice
 */
export const convertPptxToPdf = async (req: Request, res: Response) => {
  const { fileData, fileName } = req.body;
  if (!fileData) {
    res.status(400).json({ error: 'Data file PPTX wajib disertakan' });
    return;
  }

  try {
    const libreoffice = require('libreoffice-convert');
    const base64Content = fileData.startsWith('data:') ? fileData.split(',')[1] : fileData;
    const inputBuffer = Buffer.from(base64Content, 'base64');

    libreoffice.convert(inputBuffer, '.pdf', undefined, (err: any, pdfBuffer: Buffer) => {
      if (err) {
        console.warn('[LibreOffice Convert Warning]', err.message || err);
        res.json({
          success: true,
          converted: false,
          message: 'LibreOffice CLI belum terpasang di sistem server. Menggunakan fallback pembaca presentasi.',
          pdfDataUrl: fileData
        });
        return;
      }

      const pdfBase64 = pdfBuffer.toString('base64');
      res.json({
        success: true,
        converted: true,
        fileName: (fileName || 'Presentation').replace(/\.[^/.]+$/, '') + '.pdf',
        pdfDataUrl: `data:application/pdf;base64,${pdfBase64}`
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengonversi presentasi PPTX' });
  }
};
