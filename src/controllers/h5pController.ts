import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Ensure H5P Database Tables Exist
const ensureH5PTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS h5p_contents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content_type VARCHAR(50) NOT NULL DEFAULT 'INTERACTIVE_PRESENTATION',
        course_id INT NULL,
        lesson_id INT NULL,
        params_json LONGTEXT NOT NULL,
        custom_css TEXT NULL,
        theme_color VARCHAR(30) DEFAULT '#EAB308',
        author_id INT NULL,
        status VARCHAR(20) DEFAULT 'PUBLISHED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS h5p_student_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        h5p_id INT NOT NULL,
        user_id INT NOT NULL,
        score INT DEFAULT 0,
        max_score INT DEFAULT 100,
        interaction_data LONGTEXT NULL,
        status VARCHAR(20) DEFAULT 'COMPLETED',
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err) {
    console.error('Failed to ensure H5P tables:', err);
  }
};

// 1. Get All H5P Interactive Materials
export const getAllH5P = async (req: Request, res: Response) => {
  try {
    await ensureH5PTables();
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        h.*,
        c.title AS course_name,
        l.title AS lesson_name,
        u.full_name AS author_name
      FROM h5p_contents h
      LEFT JOIN courses c ON h.course_id = c.id
      LEFT JOIN lessons l ON h.lesson_id = l.id
      LEFT JOIN users u ON h.author_id = u.id
      ORDER BY h.id DESC
    `);

    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch H5P materials' });
  }
};

// 2. Get Single H5P Material by ID
export const getH5PById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await ensureH5PTables();
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        h.*,
        c.title AS course_name,
        l.title AS lesson_name,
        u.full_name AS author_name
      FROM h5p_contents h
      LEFT JOIN courses c ON h.course_id = c.id
      LEFT JOIN lessons l ON h.lesson_id = l.id
      LEFT JOIN users u ON h.author_id = u.id
      WHERE h.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Materi H5P tidak ditemukan' });
    }

    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch H5P material' });
  }
};

// 3. Create New H5P Interactive Material
// Helper to sync H5P material directly into lesson_contents table
const syncH5PToLessonContents = async (h5pId: number, lessonId: number, title: string, paramsJson: string) => {
  try {
    const contentTitle = `H5P: ${title}`;
    const attachmentMeta = JSON.stringify([{ type: 'h5p', h5p_id: h5pId }]);

    // Query for existing lesson_content matching this SPECIFIC h5pId
    const [existing] = await pool.query<RowDataPacket[]>(`
      SELECT id FROM lesson_contents 
      WHERE lesson_id = ? AND content_type = 'H5P' AND (attachments LIKE ? OR title = ?)
    `, [lessonId, `%"h5p_id":${h5pId}%`, contentTitle]);

    if (existing.length === 0) {
      const [maxOrderRow] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(content_order), 0) as max_order FROM lesson_contents WHERE lesson_id = ?',
        [lessonId]
      );
      const nextOrder = (maxOrderRow[0]?.max_order || 0) + 1;

      await pool.query(`
        INSERT INTO lesson_contents (lesson_id, content_type, title, description, content_order, is_required, estimated_minutes, status, attachments)
        VALUES (?, 'H5P', ?, ?, ?, 1, 15, 'ACTIVE', ?)
      `, [lessonId, contentTitle, paramsJson, nextOrder, attachmentMeta]);
    } else {
      await pool.query(`
        UPDATE lesson_contents
        SET title = ?, description = ?, attachments = ?
        WHERE id = ?
      `, [contentTitle, paramsJson, attachmentMeta, existing[0].id]);
    }
  } catch (err) {
    console.error('Failed to sync H5P to lesson_contents:', err);
  }
};

// 3. Create New H5P Interactive Material
export const createH5P = async (req: Request, res: Response) => {
  const { title, content_type, course_id, lesson_id, params_json, custom_css, theme_color, status } = req.body;
  const authorId = (req as any).user?.id || null;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Judul materi H5P wajib diisi' });
  }

  try {
    await ensureH5PTables();

    if (lesson_id) {
      const [lRows] = await pool.query<RowDataPacket[]>('SELECT lesson_type FROM lessons WHERE id = ?', [lesson_id]);
      if (lRows.length > 0 && lRows[0].lesson_type?.toUpperCase() !== 'READING') {
        return res.status(400).json({ error: 'Materi H5P hanya dapat ditautkan ke sub lesson bertipe READING' });
      }
    }

    const defaultParams = params_json ? (typeof params_json === 'string' ? params_json : JSON.stringify(params_json)) : JSON.stringify({
      slides: [
        {
          title: 'Slide 1: Pengenalan',
          content: 'Selamat datang di materi interaktif H5P.',
          media_type: 'NONE',
          media_url: '',
          elements: []
        }
      ]
    });

    const [result] = await pool.query<ResultSetHeader>(`
      INSERT INTO h5p_contents (title, content_type, course_id, lesson_id, params_json, custom_css, theme_color, author_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      String(title).trim(),
      content_type || 'INTERACTIVE_PRESENTATION',
      course_id ? Number(course_id) : null,
      lesson_id ? Number(lesson_id) : null,
      defaultParams,
      custom_css || '',
      theme_color || '#EAB308',
      authorId,
      status || 'PUBLISHED'
    ]);

    if (lesson_id) {
      await syncH5PToLessonContents(result.insertId, Number(lesson_id), String(title).trim(), defaultParams);
    }

    res.status(201).json({
      message: 'Materi H5P Interaktif berhasil dibuat',
      id: result.insertId
    });
  } catch (error: any) {
    console.error('Error in createH5P:', error);
    res.status(500).json({ error: error.message || 'Failed to create H5P material' });
  }
};

// 4. Update H5P Interactive Material
export const updateH5P = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content_type, course_id, lesson_id, params_json, custom_css, theme_color, status } = req.body;

  try {
    await ensureH5PTables();

    const [existing] = await pool.query<RowDataPacket[]>('SELECT * FROM h5p_contents WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Materi H5P tidak ditemukan' });
    }
    const current = existing[0];

    const finalTitle = (title !== undefined && title !== null && String(title).trim() !== '')
      ? String(title).trim()
      : current.title;

    const finalContentType = content_type || current.content_type || 'INTERACTIVE_PRESENTATION';
    const finalCourseId = course_id !== undefined ? (course_id ? Number(course_id) : null) : current.course_id;
    const finalLessonId = lesson_id !== undefined ? (lesson_id ? Number(lesson_id) : null) : current.lesson_id;

    if (finalLessonId) {
      const [lRows] = await pool.query<RowDataPacket[]>('SELECT lesson_type FROM lessons WHERE id = ?', [finalLessonId]);
      if (lRows.length > 0 && lRows[0].lesson_type?.toUpperCase() !== 'READING') {
        return res.status(400).json({ error: 'Materi H5P hanya dapat ditautkan ke sub lesson bertipe READING' });
      }
    }

    let formattedParams = current.params_json;
    if (params_json !== undefined && params_json !== null) {
      formattedParams = typeof params_json === 'object' ? JSON.stringify(params_json) : String(params_json);
    }

    const finalCustomCss = custom_css !== undefined ? String(custom_css) : (current.custom_css || '');
    const finalThemeColor = theme_color || current.theme_color || '#EAB308';
    const finalStatus = status || current.status || 'PUBLISHED';

    await pool.query(`
      UPDATE h5p_contents
      SET 
        title = ?,
        content_type = ?,
        course_id = ?,
        lesson_id = ?,
        params_json = ?,
        custom_css = ?,
        theme_color = ?,
        status = ?
      WHERE id = ?
    `, [
      finalTitle,
      finalContentType,
      finalCourseId,
      finalLessonId,
      formattedParams,
      finalCustomCss,
      finalThemeColor,
      finalStatus,
      id
    ]);

    if (finalLessonId) {
      await syncH5PToLessonContents(Number(id), Number(finalLessonId), finalTitle, formattedParams);
    }

    res.json({ message: 'Materi H5P Interaktif berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error in updateH5P:', error);
    res.status(500).json({ error: error.message || 'Failed to update H5P material' });
  }
};

// 5. Delete H5P Interactive Material
export const deleteH5P = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await ensureH5PTables();
    await pool.query('DELETE FROM h5p_contents WHERE id = ?', [id]);
    res.json({ message: 'Materi H5P berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete H5P material' });
  }
};

// 6. Attach H5P Content directly into Lesson Syllabus
export const attachH5PToLesson = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { lesson_id, course_id } = req.body;

  if (!lesson_id) {
    return res.status(400).json({ error: 'Pilih modul / lesson target terlebih dahulu' });
  }

  try {
    await ensureH5PTables();

    const [lRows] = await pool.query<RowDataPacket[]>('SELECT lesson_type FROM lessons WHERE id = ?', [lesson_id]);
    if (lRows.length > 0 && lRows[0].lesson_type?.toUpperCase() !== 'READING') {
      return res.status(400).json({ error: 'Materi H5P hanya dapat ditautkan ke sub lesson bertipe READING' });
    }

    // 1. Update H5P record
    await pool.query(`
      UPDATE h5p_contents
      SET lesson_id = ?, course_id = ?
      WHERE id = ?
    `, [Number(lesson_id), course_id ? Number(course_id) : null, id]);

    // 2. Insert or Update lesson_contents record of type 'H5P'
    const [h5pRow] = await pool.query<RowDataPacket[]>('SELECT title, params_json FROM h5p_contents WHERE id = ?', [id]);
    if (h5pRow.length > 0) {
      await syncH5PToLessonContents(Number(id), Number(lesson_id), h5pRow[0].title, h5pRow[0].params_json);
    }

    res.json({ message: 'Materi H5P berhasil ditautkan ke silabus pelajaran' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to attach H5P to lesson' });
  }
};

// 7. Student Submit Attempt / Interaction
export const submitH5PAttempt = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { score, max_score, interaction_data } = req.body;
  const userId = (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Pengguna wajib login untuk menyimpan progress' });
  }

  try {
    await ensureH5PTables();

    const finalScore = Number(score) || 0;
    const finalMaxScore = Number(max_score) || 100;
    const dataString = typeof interaction_data === 'object' ? JSON.stringify(interaction_data) : String(interaction_data || '');

    await pool.query(`
      INSERT INTO h5p_student_attempts (h5p_id, user_id, score, max_score, interaction_data, status)
      VALUES (?, ?, ?, ?, ?, 'COMPLETED')
    `, [id, userId, finalScore, finalMaxScore, dataString]);

    // Award XP (e.g. 20 XP for completing H5P interactive material)
    const xpReward = 20;
    await pool.query(`
      UPDATE users SET xp = xp + ? WHERE id = ?
    `, [xpReward, userId]);

    res.json({
      message: 'Hasil interaktif H5P berhasil disimpan!',
      score: finalScore,
      xp_gained: xpReward
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to submit H5P attempt' });
  }
};

// 8. Upload Media File (Images, GIFs, Audio clips for H5P Elements)
export const uploadH5PMedia = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file media yang diunggah' });
    }
    const mediaUrl = `http://localhost:5000/uploads/h5p/${req.file.filename}`;
    res.json({
      message: 'File media berhasil diunggah!',
      url: mediaUrl,
      filename: req.file.filename
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengunggah file media' });
  }
};
