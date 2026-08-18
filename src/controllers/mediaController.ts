import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/db';
import path from 'path';
import fs from 'fs';

// Helper to determine file_type from mime type or file extension
function determineFileType(mimeType: string, filename: string): 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT' | 'OTHER' {
  const lowerMime = (mimeType || '').toLowerCase();
  const ext = path.extname(filename || '').toLowerCase();

  if (lowerMime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) {
    return 'AUDIO';
  }
  if (lowerMime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'].includes(ext)) {
    return 'VIDEO';
  }
  if (lowerMime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) {
    return 'IMAGE';
  }
  if (
    lowerMime.includes('pdf') ||
    lowerMime.includes('document') ||
    lowerMime.includes('word') ||
    lowerMime.includes('excel') ||
    lowerMime.includes('powerpoint') ||
    lowerMime.includes('text') ||
    ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip', '.rar'].includes(ext)
  ) {
    return 'DOCUMENT';
  }
  return 'OTHER';
}

// 1. GET /api/media
export const getMediaList = async (req: AuthRequest, res: Response) => {
  try {
    const {
      search = '',
      type = 'ALL',
      page = '1',
      limit = '50',
      placement_course,
      placement_lesson
    } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT id, title, filename, file_url, file_type, mime_type, file_size, duration_seconds,
             source_type, ai_prompt_text, ai_voice_code, ai_speed, usage_count, target_placement,
             status, created_by, created_at, updated_at
      FROM media_files
      WHERE deleted_at IS NULL
    `;
    const params: any[] = [];

    if (type && type !== 'ALL') {
      if (type === 'AI_TTS') {
        query += ` AND source_type = 'AI_TTS'`;
      } else {
        query += ` AND file_type = ?`;
        params.push(type);
      }
    }

    // Specific placement filtering (only return general media OR media matching this specific lesson or course)
    if (placement_course || placement_lesson) {
      const courseStr = typeof placement_course === 'string' ? placement_course.trim() : '';
      const lessonStr = typeof placement_lesson === 'string' ? placement_lesson.trim() : '';

      if (courseStr && lessonStr) {
        query += ` AND (
          target_placement IS NULL 
          OR target_placement = '' 
          OR target_placement = 'Umum' 
          OR target_placement LIKE '%Perpustakaan Media Umum%'
          OR target_placement LIKE ? 
          OR target_placement = ?
        )`;
        params.push(`%${lessonStr}%`, courseStr);
      } else if (lessonStr) {
        query += ` AND (
          target_placement IS NULL 
          OR target_placement = '' 
          OR target_placement = 'Umum' 
          OR target_placement LIKE '%Perpustakaan Media Umum%'
          OR target_placement LIKE ?
        )`;
        params.push(`%${lessonStr}%`);
      } else if (courseStr) {
        query += ` AND (
          target_placement IS NULL 
          OR target_placement = '' 
          OR target_placement = 'Umum' 
          OR target_placement LIKE '%Perpustakaan Media Umum%'
          OR target_placement LIKE ?
        )`;
        params.push(`%${courseStr}%`);
      }
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      query += ` AND (title LIKE ? OR filename LIKE ? OR ai_prompt_text LIKE ? OR target_placement LIKE ?)`;
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const [rows]: any = await pool.query(query, params);

    // Get counts per category for the tabs
    const [counts]: any = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN file_type = 'VIDEO' THEN 1 ELSE 0 END) as videoCount,
        SUM(CASE WHEN file_type = 'AUDIO' THEN 1 ELSE 0 END) as audioCount,
        SUM(CASE WHEN file_type = 'IMAGE' THEN 1 ELSE 0 END) as imageCount,
        SUM(CASE WHEN file_type = 'DOCUMENT' THEN 1 ELSE 0 END) as docCount,
        SUM(CASE WHEN file_type = 'LINK' THEN 1 ELSE 0 END) as linkCount,
        SUM(CASE WHEN source_type = 'AI_TTS' THEN 1 ELSE 0 END) as aiCount
      FROM media_files
      WHERE deleted_at IS NULL
    `);

    res.json({
      success: true,
      data: rows || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: counts[0]?.total || 0,
      },
      counts: {
        total: counts[0]?.total || 0,
        videoCount: counts[0]?.videoCount || 0,
        audioCount: counts[0]?.audioCount || 0,
        imageCount: counts[0]?.imageCount || 0,
        docCount: counts[0]?.docCount || 0,
        linkCount: counts[0]?.linkCount || 0,
        aiCount: counts[0]?.aiCount || 0,
      }
    });
  } catch (error: any) {
    console.error('Error fetching media list:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch media list' });
  }
};

// 2. POST /api/media/upload
export const uploadMediaFile = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const customTitle = req.body.title ? req.body.title.trim() : file.originalname;
    const targetPlacement = req.body.target_placement ? req.body.target_placement.trim() : null;
    const durationSeconds = parseInt(req.body.duration_seconds) || 0;

    const fileType = determineFileType(file.mimetype, file.originalname);
    const fileUrl = `/uploads/media/${file.filename}`;

    const [result]: any = await pool.query(`
      INSERT INTO media_files 
      (title, filename, file_url, file_type, mime_type, file_size, duration_seconds, source_type, target_placement, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'UPLOAD', ?, ?)
    `, [
      customTitle,
      file.originalname,
      fileUrl,
      fileType,
      file.mimetype || 'application/octet-stream',
      file.size || 0,
      durationSeconds,
      targetPlacement,
      req.user?.id || null
    ]);

    const [inserted]: any = await pool.query('SELECT * FROM media_files WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: inserted[0]
    });
  } catch (error: any) {
    console.error('Error uploading media file:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
};

// 3. POST /api/media/link
export const addMediaLink = async (req: AuthRequest, res: Response) => {
  try {
    const { url, title, duration_seconds = 0, target_placement = null } = req.body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      res.status(400).json({ error: 'Valid URL is required' });
      return;
    }

    const cleanUrl = url.trim();
    const cleanTitle = title && title.trim() ? title.trim() : cleanUrl;
    
    // Check if YouTube
    const isYoutube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
    const mimeType = isYoutube ? 'video/youtube' : 'text/uri-list';

    const [result]: any = await pool.query(`
      INSERT INTO media_files 
      (title, filename, file_url, file_type, mime_type, file_size, duration_seconds, source_type, target_placement, created_by)
      VALUES (?, ?, ?, 'LINK', ?, 0, ?, 'EXTERNAL_LINK', ?, ?)
    `, [
      cleanTitle,
      cleanTitle,
      cleanUrl,
      mimeType,
      parseInt(duration_seconds) || 0,
      target_placement,
      req.user?.id || null
    ]);

    const [inserted]: any = await pool.query('SELECT * FROM media_files WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Media link added successfully',
      data: inserted[0]
    });
  } catch (error: any) {
    console.error('Error adding media link:', error);
    res.status(500).json({ error: error.message || 'Failed to add media link' });
  }
};

// Helper for Emotion-Aware Pitch & Rate calculation
function getEmotionPitchAndRate(emotion: string, baseSpeed: number) {
  let pitch = '+0Hz';
  let speedMultiplier = baseSpeed;

  switch (emotion) {
    case 'cheerful':
      pitch = '+6Hz';
      speedMultiplier *= 1.04;
      break;
    case 'enthusiastic':
      pitch = '+10Hz';
      speedMultiplier *= 1.08;
      break;
    case 'calm':
      pitch = '-4Hz';
      speedMultiplier *= 0.94;
      break;
    case 'inquisitive':
      pitch = '+8Hz';
      speedMultiplier *= 0.98;
      break;
    case 'storyteller':
      pitch = '+2Hz';
      speedMultiplier *= 0.96;
      break;
    case 'formal':
    case 'neutral':
    default:
      pitch = '+0Hz';
      break;
  }

  let rateStr = '+0%';
  if (speedMultiplier !== 1.0) {
    const pct = Math.round((speedMultiplier - 1.0) * 100);
    rateStr = pct >= 0 ? `+${pct}%` : `${pct}%`;
  }

  return { pitch, rateStr };
}

// 4. POST /api/media/generate-ai-audio (Single Voice with Emotion-Aware Support)
export const generateAiAudio = async (req: AuthRequest, res: Response) => {
  try {
    const {
      text,
      voice = 'en-US-EmmaNeural',
      speed = 1.0,
      emotion = 'neutral',
      target_placement = null,
      force_new = false
    } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Kalimat teks yang diucapkan wajib diisi' });
      return;
    }

    const cleanText = text.trim();
    const speedNum = Number(speed) || 1.0;

    // Check if identical audio already exists in media_files cache
    if (!force_new) {
      const [existing]: any = await pool.query(`
        SELECT * FROM media_files 
        WHERE source_type = 'AI_TTS' 
          AND ai_prompt_text = ? 
          AND ai_voice_code = ? 
          AND ai_speed = ? 
          AND deleted_at IS NULL
        LIMIT 1
      `, [cleanText, voice, speedNum]);

      if (existing && existing.length > 0) {
        const existingRecord = existing[0];
        const localPath = path.join(__dirname, '../../', existingRecord.file_url);
        if (fs.existsSync(localPath)) {
          res.json({
            success: true,
            isCached: true,
            message: `Kalimat ini sudah pernah dibuat dengan suara ${voice}. Menggunakan berkas yang sudah ada.`,
            data: existingRecord
          });
          return;
        }
      }
    }

    const { pitch, rateStr } = getEmotionPitchAndRate(emotion, speedNum);

    // Synthesize using Edge-TTS
    const { Communicate } = require('edge-tts-universal');
    const communicate = new Communicate(cleanText, {
      voice: voice || 'en-US-EmmaNeural',
      rate: rateStr,
      pitch: pitch
    });

    const chunks: Buffer[] = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio') {
        chunks.push(chunk.data);
      }
    }

    const audioBuffer = Buffer.concat(chunks);
    if (audioBuffer.length === 0) {
      throw new Error('TTS buffer output was empty');
    }

    // Save to uploads/media directory
    const mediaDir = path.join(process.cwd(), 'uploads', 'media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e5);
    const filename = `ai-audio-${uniqueId}.mp3`;
    const fullPath = path.join(mediaDir, filename);
    fs.writeFileSync(fullPath, audioBuffer);

    // Approximate duration
    const wordCount = cleanText.split(/\s+/).length;
    const estDuration = Math.max(1, Math.round((wordCount / (2.5 * speedNum))));

    const title = cleanText.length > 30 ? cleanText.substring(0, 30) + '...' : cleanText;
    const fileUrl = `/uploads/media/${filename}`;

    const [result]: any = await pool.query(`
      INSERT INTO media_files
      (title, filename, file_url, file_type, mime_type, file_size, duration_seconds, source_type, ai_prompt_text, ai_voice_code, ai_speed, target_placement, created_by)
      VALUES (?, ?, ?, 'AUDIO', 'audio/mpeg', ?, ?, 'AI_TTS', ?, ?, ?, ?, ?)
    `, [
      title,
      filename,
      fileUrl,
      audioBuffer.length,
      estDuration,
      cleanText,
      voice,
      speedNum,
      target_placement,
      req.user?.id || null
    ]);

    const [inserted]: any = await pool.query('SELECT * FROM media_files WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      isCached: false,
      message: 'Audio berhasil dibuat dengan AI dan disimpan ke Media Library!',
      data: inserted[0]
    });
  } catch (error: any) {
    console.error('Error generating AI audio:', error);
    res.status(500).json({ error: error.message || 'Gagal membuat audio AI' });
  }
};

// 4B. POST /api/media/generate-ai-dialogue (Multi-Speaker Dialogue with Emotion-Awareness)
export const generateAiDialogue = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      dialogue_lines,
      target_placement = null
    } = req.body;

    if (!Array.isArray(dialogue_lines) || dialogue_lines.length === 0) {
      res.status(400).json({ error: 'Daftar baris dialog wajib diisi (minimal 1 baris)' });
      return;
    }

    const { Communicate } = require('edge-tts-universal');
    const audioSegments: Buffer[] = [];
    const fullTranscriptLines: string[] = [];

    for (let i = 0; i < dialogue_lines.length; i++) {
      const line = dialogue_lines[i];
      const speakerName = line.speaker || `Speaker ${i + 1}`;
      const lineText = (line.text || '').trim();
      const lineVoice = line.voice || 'en-US-EmmaNeural';
      const lineSpeed = Number(line.speed) || 1.0;
      const lineEmotion = line.emotion || 'neutral';

      if (!lineText) continue;

      fullTranscriptLines.push(`[${speakerName}]: "${lineText}"`);

      const { pitch, rateStr } = getEmotionPitchAndRate(lineEmotion, lineSpeed);

      const communicate = new Communicate(lineText, {
        voice: lineVoice,
        rate: rateStr,
        pitch: pitch
      });

      const lineChunks: Buffer[] = [];
      for await (const chunk of communicate.stream()) {
        if (chunk.type === 'audio') {
          lineChunks.push(chunk.data);
        }
      }

      if (lineChunks.length > 0) {
        audioSegments.push(Buffer.concat(lineChunks));
      }
    }

    if (audioSegments.length === 0) {
      res.status(400).json({ error: 'Tidak ada baris percakapan teks yang dapat disintesis' });
      return;
    }

    // Combine all audio buffers seamlessly
    const combinedBuffer = Buffer.concat(audioSegments);

    // Save combined dialogue audio file
    const mediaDir = path.join(process.cwd(), 'uploads', 'media');
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }

    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e5);
    const filename = `ai-dialogue-${uniqueId}.mp3`;
    const fullPath = path.join(mediaDir, filename);
    fs.writeFileSync(fullPath, combinedBuffer);

    const fullPromptText = fullTranscriptLines.join('\n');
    const autoTitle = title?.trim() || `Dialog Percakapan (${dialogue_lines.length} Baris)`;
    const fileUrl = `/uploads/media/${filename}`;

    // Approximate duration
    const totalWords = fullPromptText.split(/\s+/).length;
    const estDuration = Math.max(1, Math.round(totalWords / 2.5));

    const [result]: any = await pool.query(`
      INSERT INTO media_files
      (title, filename, file_url, file_type, mime_type, file_size, duration_seconds, source_type, ai_prompt_text, ai_voice_code, ai_speed, target_placement, created_by)
      VALUES (?, ?, ?, 'AUDIO', 'audio/mpeg', ?, ?, 'AI_TTS', ?, 'MULTI_SPEAKER', 1.00, ?, ?)
    `, [
      autoTitle,
      filename,
      fileUrl,
      combinedBuffer.length,
      estDuration,
      fullPromptText,
      target_placement,
      req.user?.id || null
    ]);

    const [inserted]: any = await pool.query('SELECT * FROM media_files WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Audio kombinasi dialog multi-suara berhasil dibuat!',
      data: inserted[0]
    });
  } catch (error: any) {
    console.error('Error generating AI dialogue:', error);
    res.status(500).json({ error: error.message || 'Gagal membuat kombinasi audio dialog' });
  }
};

// 4C. POST /api/media/synthesize-preview (Stream live preview directly)
export const synthesizeMediaPreview = async (req: AuthRequest, res: Response) => {
  try {
    const {
      mode = 'single', // 'single' | 'dialogue'
      text,
      voice = 'en-US-EmmaNeural',
      speed = 1.0,
      emotion = 'neutral',
      dialogue_lines
    } = req.body;

    const { Communicate } = require('edge-tts-universal');

    if (mode === 'dialogue' && Array.isArray(dialogue_lines)) {
      const audioSegments: Buffer[] = [];
      for (const line of dialogue_lines) {
        const lineText = (line.text || '').trim();
        if (!lineText) continue;
        const lineVoice = line.voice || 'en-US-EmmaNeural';
        const lineSpeed = Number(line.speed) || 1.0;
        const lineEmotion = line.emotion || 'neutral';
        const { pitch, rateStr } = getEmotionPitchAndRate(lineEmotion, lineSpeed);

        const comm = new Communicate(lineText, {
          voice: lineVoice,
          rate: rateStr,
          pitch: pitch
        });
        const chunks: Buffer[] = [];
        for await (const chunk of comm.stream()) {
          if (chunk.type === 'audio') chunks.push(chunk.data);
        }
        if (chunks.length > 0) audioSegments.push(Buffer.concat(chunks));
      }

      const combined = Buffer.concat(audioSegments);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', combined.length);
      res.send(combined);
      return;
    }

    // Single voice preview
    const cleanText = (text || '').trim();
    if (!cleanText) {
      res.status(400).json({ error: 'Text required' });
      return;
    }

    const { pitch, rateStr } = getEmotionPitchAndRate(emotion, Number(speed) || 1.0);
    const comm = new Communicate(cleanText, {
      voice: voice || 'en-US-EmmaNeural',
      rate: rateStr,
      pitch: pitch
    });

    const chunks: Buffer[] = [];
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio') chunks.push(chunk.data);
    }
    const resultBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', resultBuffer.length);
    res.send(resultBuffer);
  } catch (error: any) {
    console.error('Error synthesizing preview:', error);
    res.status(500).json({ error: error.message || 'Failed to synthesize audio preview' });
  }
};


// 5. PUT /api/media/:id
export const updateMedia = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, target_placement, usage_count } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (target_placement !== undefined) {
      updates.push('target_placement = ?');
      params.push(target_placement);
    }
    if (usage_count !== undefined) {
      updates.push('usage_count = ?');
      params.push(parseInt(usage_count) || 0);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(id);
    await pool.query(`UPDATE media_files SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated]: any = await pool.query('SELECT * FROM media_files WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Media updated successfully',
      data: updated[0]
    });
  } catch (error: any) {
    console.error('Error updating media:', error);
    res.status(500).json({ error: error.message || 'Failed to update media' });
  }
};

// 6. DELETE /api/media/:id
export const deleteMedia = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query('SELECT * FROM media_files WHERE id = ?', [id]);

    if (!rows || rows.length === 0) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    const item = rows[0];

    // Delete local file if it's stored on disk and was an upload / AI generated
    if (item.file_url && item.file_url.startsWith('/uploads/media/')) {
      const localPath = path.join(__dirname, '../../', item.file_url);
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch (e) {
          console.warn('Could not unlink local media file:', e);
        }
      }
    }

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: error.message || 'Failed to delete media' });
  }
};

// 7. GET /api/media/target-lessons (Returns courses and lessons of type READING & VIDEO)
export const getTargetLessons = async (req: AuthRequest, res: Response) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        c.id as course_id,
        c.title as course_title,
        m.id as module_id,
        m.title as module_title,
        l.id as lesson_id,
        l.title as lesson_title,
        l.lesson_type
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      JOIN course_versions cv ON m.course_version_id = cv.id
      JOIN courses c ON cv.course_id = c.id
      WHERE l.lesson_type IN ('READING', 'VIDEO')
      ORDER BY c.title ASC, m.module_order ASC, l.lesson_order ASC
    `);

    // Group lessons under each course
    const courseMap = new Map();
    for (const r of rows) {
      if (!courseMap.has(r.course_id)) {
        courseMap.set(r.course_id, {
          course_id: r.course_id,
          course_title: r.course_title,
          lessons: []
        });
      }
      courseMap.get(r.course_id).lessons.push({
        lesson_id: r.lesson_id,
        lesson_title: r.lesson_title,
        lesson_type: r.lesson_type,
        module_title: r.module_title,
        display_label: `[${r.lesson_type === 'READING' ? '📖 Reading' : '🎥 Video'}] ${r.module_title} · ${r.lesson_title}`
      });
    }

    res.json({
      success: true,
      data: Array.from(courseMap.values())
    });
  } catch (error: any) {
    console.error('Error fetching target lessons:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch target lessons' });
  }
};

// Alias for backward compatibility
export const getSpeakingTargets = getTargetLessons;


