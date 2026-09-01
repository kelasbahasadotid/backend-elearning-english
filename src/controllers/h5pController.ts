import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { updateProgressHelper } from '../utils/progress';

const slugify = (text: string) => text
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^\w-]+/g, '')
  .replace(/--+/g, '-')
  .replace(/^-+|-+$/g, '');

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
    `, [lessonId, `%"h5p_id":${h5pId}}%`, contentTitle]);

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
    const [rows] = await pool.query<RowDataPacket[]>('SELECT lesson_id, title FROM h5p_contents WHERE id = ?', [id]);
    const lessonId = rows[0]?.lesson_id ? Number(rows[0].lesson_id) : null;

    if (lessonId) {
      await pool.query(
        `DELETE FROM lesson_contents
         WHERE lesson_id = ? AND content_type = 'H5P'
           AND (attachments LIKE ? OR title = ?)`,
        [lessonId, `%"h5p_id":${Number(id)}}%`, `H5P: ${rows[0].title}`]
      );
    }
    await pool.query('DELETE FROM h5p_student_attempts WHERE h5p_id = ?', [id]);
    await pool.query('DELETE FROM h5p_contents WHERE id = ?', [id]);

    if (lessonId) {
      const [usage] = await pool.query<RowDataPacket[]>(
        `SELECT
           (SELECT COUNT(*) FROM lesson_contents WHERE lesson_id = ?) +
           (SELECT COUNT(*) FROM assessments WHERE lesson_id = ?) +
           (SELECT COUNT(*) FROM speaking_tests WHERE lesson_id = ?) AS usage_count`,
        [lessonId, lessonId, lessonId]
      );
      // Lesson backing yang dibuat otomatis tidak boleh tertinggal sebagai
      // materi kosong setelah H5P satu-satunya dihapus.
      if (Number(usage[0]?.usage_count || 0) === 0) {
        await pool.query('DELETE FROM lesson_progress WHERE lesson_id = ?', [lessonId]);
        await pool.query('DELETE FROM lesson_bookmarks WHERE lesson_id = ?', [lessonId]).catch(() => {});
        await pool.query('DELETE FROM lessons WHERE id = ?', [lessonId]);
      }
    }
    res.json({ message: 'Materi H5P berhasil dihapus' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete H5P material' });
  }
};

// 6. Attach H5P Content directly into Lesson Syllabus
export const attachH5PToLesson = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { lesson_id, module_id, course_id, title } = req.body;

  if (!lesson_id && !module_id) {
    return res.status(400).json({ error: 'Pilih topic atau lesson target terlebih dahulu' });
  }

  try {
    await ensureH5PTables();

    const [h5pRows] = await pool.query<RowDataPacket[]>('SELECT title, lesson_id, params_json FROM h5p_contents WHERE id = ?', [id]);
    if (h5pRows.length === 0) {
      return res.status(404).json({ error: 'Materi H5P tidak ditemukan' });
    }
    const h5p = h5pRows[0];
    const finalTitle = String(title || h5p.title || 'Untitled H5P Presentation').trim();
    let targetLessonId = lesson_id ? Number(lesson_id) : null;

    if (targetLessonId) {
      const [lRows] = await pool.query<RowDataPacket[]>('SELECT lesson_type FROM lessons WHERE id = ?', [targetLessonId]);
      if (lRows.length === 0) {
        return res.status(404).json({ error: 'Lesson target tidak ditemukan' });
      }
      if (lRows[0].lesson_type?.toUpperCase() !== 'READING') {
        return res.status(400).json({ error: 'Materi H5P hanya dapat ditautkan ke lesson bertipe READING' });
      }
    } else {
      const targetModuleId = Number(module_id);
      const [moduleRows] = await pool.query<RowDataPacket[]>(
        `SELECT m.id, cv.course_id
         FROM modules m
         JOIN course_versions cv ON cv.id = m.course_version_id
         WHERE m.id = ?`,
        [targetModuleId]
      );
      if (moduleRows.length === 0) {
        return res.status(404).json({ error: 'Topic target tidak ditemukan' });
      }
      if (course_id && Number(moduleRows[0].course_id) !== Number(course_id)) {
        return res.status(400).json({ error: 'Topic target bukan bagian dari kelas ini' });
      }

      // H5P tetap membutuhkan row lesson untuk urutan, penguncian, dan progress
      // siswa. Row itu sekarang dibuat otomatis, jadi admin tidak perlu lagi
      // membuat lesson Reading kosong sebelum menambahkan H5P.
      if (h5p.lesson_id) {
        const [existingLesson] = await pool.query<RowDataPacket[]>(
          `SELECT l.id,
             (SELECT COUNT(*) FROM lesson_contents lc
              WHERE lc.lesson_id = l.id AND lc.content_type <> 'H5P') AS regular_content_count
           FROM lessons l WHERE l.id = ?`,
          [h5p.lesson_id]
        );
        if (existingLesson.length > 0 && Number(existingLesson[0].regular_content_count || 0) === 0) {
          targetLessonId = Number(h5p.lesson_id);
          await pool.query(
            `UPDATE lessons
             SET module_id = ?, lesson_type = 'READING', title = ?, slug = ?, duration_minutes = 15, xp_reward = 20, status = 'PUBLISHED'
             WHERE id = ?`,
            [targetModuleId, finalTitle, slugify(finalTitle), targetLessonId]
          );
        }
      }

      if (!targetLessonId) {
        const [maxOrderRows] = await pool.query<RowDataPacket[]>(
          'SELECT COALESCE(MAX(lesson_order), 0) AS max_order FROM lessons WHERE module_id = ?',
          [targetModuleId]
        );
        const [lessonResult] = await pool.query<ResultSetHeader>(
          `INSERT INTO lessons
           (module_id, lesson_type, title, slug, lesson_order, duration_minutes, is_preview, is_required, passing_score, xp_reward, max_attempt, status)
           VALUES (?, 'READING', ?, ?, ?, 15, 0, 1, 70, 20, NULL, 'PUBLISHED')`,
          [targetModuleId, finalTitle, slugify(finalTitle), Number(maxOrderRows[0]?.max_order || 0) + 1]
        );
        targetLessonId = lessonResult.insertId;
      }

      if (h5p.lesson_id && Number(h5p.lesson_id) !== targetLessonId) {
        await pool.query(
          `DELETE FROM lesson_contents
           WHERE lesson_id = ? AND content_type = 'H5P' AND attachments LIKE ?`,
          [h5p.lesson_id, `%"h5p_id":${Number(id)}}%`]
        );
      }
    }

    // 1. Update H5P record
    await pool.query(`
      UPDATE h5p_contents
      SET title = ?, lesson_id = ?, course_id = ?
      WHERE id = ?
    `, [finalTitle, targetLessonId, course_id ? Number(course_id) : null, id]);

    // 2. Insert or Update lesson_contents record of type 'H5P'
    await syncH5PToLessonContents(Number(id), targetLessonId, finalTitle, h5p.params_json);

    res.json({ message: 'Materi H5P berhasil ditambahkan ke topic', lessonId: targetLessonId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to attach H5P to lesson' });
  }
};

// 7. Student Submit Attempt / Interaction
export const submitH5PAttempt = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { score } = req.body;
  const userId = (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Pengguna wajib login untuk menyimpan progress' });
  }

  try {
    await ensureH5PTables();
    const [h5pRows] = await pool.query<RowDataPacket[]>('SELECT lesson_id FROM h5p_contents WHERE id = ?', [id]);
    const lessonId = Number(h5pRows[0]?.lesson_id || 0);
    if (!lessonId) {
      return res.status(400).json({ error: 'Materi H5P belum ditautkan ke lesson' });
    }

    // Kompatibilitas untuk frontend lama: tombol submit lama tidak lagi
    // menyimpan attempt/menilai H5P. Ia diarahkan ke completion lesson yang
    // idempoten, sama seperti mencapai slide terakhir di frontend baru.
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await updateProgressHelper(connection, userId, lessonId, true, 100);
      await connection.commit();
      res.json({
        message: 'Pelajaran H5P berhasil diselesaikan',
        score: Number(score) || 0,
        xp_gained: result?.awardXp ? 20 : 0
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const mediaUrl = `${baseUrl}/uploads/h5p/${req.file.filename}`;
    res.json({
      message: 'File media berhasil diunggah!',
      url: mediaUrl,
      filename: req.file.filename
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengunggah file media' });
  }
};
