import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import fs from 'fs';
import path from 'path';

export interface YouTubeCsvRow {
  topic: string;
  lesson_id: number | null;
  lesson: string;
  youtube_url: string;
}

export interface ImportResult {
  totalRows: number;
  insertedMedia: number;
  updatedMedia: number;
  attachedToLessons: number;
  errors: Array<{ line: number; row: any; error: string }>;
  sampleItems: Array<{
    id?: number;
    title: string;
    url: string;
    targetPlacement: string;
    lessonId: number | null;
    action: 'INSERTED' | 'UPDATED' | 'SKIPPED';
  }>;
}

/**
 * Robust CSV line parser handling quotes, commas within quotes, and escaped quotes
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV text into structured YouTube rows
 * Expects headers: topic,lesson_id,lesson,youtube_url
 */
export function parseYouTubeCsv(csvContent: string): YouTubeCsvRow[] {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const topicIdx = headers.findIndex((h) => h.includes('topic'));
  const lessonIdIdx = headers.findIndex((h) => h.includes('lesson_id') || h.includes('id'));
  const lessonIdx = headers.findIndex((h) => h === 'lesson' || h.includes('materi') || h.includes('title'));
  const urlIdx = headers.findIndex((h) => h.includes('url') || h.includes('link') || h.includes('youtube'));

  const rows: YouTubeCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 2) continue;

    const topic = topicIdx !== -1 ? cols[topicIdx] || '' : cols[0] || '';
    const rawLessonId = lessonIdIdx !== -1 ? cols[lessonIdIdx] : (cols[1] || '');
    const lessonIdNum = parseInt(rawLessonId, 10);
    const lessonId = isNaN(lessonIdNum) ? null : lessonIdNum;

    const lesson = lessonIdx !== -1 ? cols[lessonIdx] || '' : cols[2] || '';
    const youtubeUrl = urlIdx !== -1 ? cols[urlIdx] || '' : cols[cols.length - 1] || '';

    if (!youtubeUrl) continue;

    rows.push({
      topic,
      lesson_id: lessonId,
      lesson: lesson || topic || 'YouTube Video',
      youtube_url: youtubeUrl.trim()
    });
  }

  return rows;
}

/**
 * Generate CSV template string for YouTube video upload
 */
export function getYouTubeCsvTemplate(): string {
  return [
    'topic,lesson_id,lesson,youtube_url',
    'Introduction (Pengenalan Kursus),84,Course Overview,https://youtu.be/BPbgYfL__yQ',
    'Mindset (Cara Berpikir Pembelajar),87,Growth and Fixed Mindset,https://youtu.be/lF-YsUmO85w',
    'Topic 1: “Aleksander”?,98,Vaccine Registration,https://youtu.be/yPvA95OCZwY',
    'Topic 1: “Aleksander”?,99,Subject (Materi),https://youtu.be/Lv2ui9OatYo'
  ].join('\r\n');
}

/**
 * Import parsed YouTube rows into media_files table and optionally link to lesson_contents
 */
export async function importYouTubeVideos(
  rows: YouTubeCsvRow[],
  adminUserId: number = 1,
  options: { attachToLessonContent?: boolean } = { attachToLessonContent: true }
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: rows.length,
    insertedMedia: 0,
    updatedMedia: 0,
    attachedToLessons: 0,
    errors: [],
    sampleItems: []
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const cleanUrl = row.youtube_url.trim();
      const cleanTitle = row.lesson.trim() || 'YouTube Video';
      const placement = `${row.topic.trim()}${row.lesson ? ' · ' + row.lesson.trim() : ''}`.trim();

      // 1. Check if media already exists in media_files by URL
      const [existingMedia] = await pool.query<RowDataPacket[]>(
        `SELECT id, title, target_placement FROM media_files WHERE file_url = ? AND deleted_at IS NULL LIMIT 1`,
        [cleanUrl]
      );

      let mediaId: number;
      let action: 'INSERTED' | 'UPDATED' | 'SKIPPED' = 'INSERTED';

      if (existingMedia.length > 0) {
        mediaId = existingMedia[0].id;
        action = 'UPDATED';
        await pool.query(
          `UPDATE media_files 
           SET title = ?, 
               filename = ?, 
               target_placement = ?, 
               file_type = 'VIDEO', 
               mime_type = 'video/youtube', 
               source_type = 'EXTERNAL_LINK',
               status = 'READY',
               updated_at = NOW()
           WHERE id = ?`,
          [cleanTitle, cleanTitle, placement, mediaId]
        );
        result.updatedMedia++;
      } else {
        const [insertRes] = await pool.query<ResultSetHeader>(
          `INSERT INTO media_files 
           (title, filename, file_url, file_type, mime_type, file_size, duration_seconds, source_type, target_placement, status, created_by)
           VALUES (?, ?, ?, 'VIDEO', 'video/youtube', 0, 0, 'EXTERNAL_LINK', ?, 'READY', ?)`,
          [cleanTitle, cleanTitle, cleanUrl, placement, adminUserId]
        );
        mediaId = insertRes.insertId;
        action = 'INSERTED';
        result.insertedMedia++;
      }

      // 2. Optionally link to lesson_contents if lesson_id is provided and valid
      if (options.attachToLessonContent && row.lesson_id) {
        const [lessonRows] = await pool.query<RowDataPacket[]>(
          `SELECT id, title FROM lessons WHERE id = ? LIMIT 1`,
          [row.lesson_id]
        );

        if (lessonRows.length > 0) {
          // Check if video content already exists for this lesson
          const [existingContent] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM lesson_contents 
             WHERE lesson_id = ? AND (description LIKE ? OR attachments LIKE ?)
             LIMIT 1`,
            [row.lesson_id, `%${cleanUrl}%`, `%${cleanUrl}%`]
          );

          if (existingContent.length === 0) {
            // Get max order
            const [orderRows] = await pool.query<RowDataPacket[]>(
              `SELECT COALESCE(MAX(content_order), 0) as max_order FROM lesson_contents WHERE lesson_id = ?`,
              [row.lesson_id]
            );
            const nextOrder = (Number(orderRows[0]?.max_order) || 0) + 1;

            const attachmentsJson = JSON.stringify([
              {
                name: cleanTitle,
                url: cleanUrl,
                type: 'video/youtube'
              }
            ]);

            await pool.query(
              `INSERT INTO lesson_contents 
               (lesson_id, content_type, title, description, content_order, is_required, estimated_minutes, status, attachments)
               VALUES (?, 'VIDEO', ?, ?, ?, 1, 10, 'ACTIVE', ?)`,
              [
                row.lesson_id,
                `Video: ${cleanTitle}`,
                cleanUrl,
                nextOrder,
                attachmentsJson
              ]
            );

            result.attachedToLessons++;
          }
        }
      }

      if (result.sampleItems.length < 10) {
        result.sampleItems.push({
          id: mediaId,
          title: cleanTitle,
          url: cleanUrl,
          targetPlacement: placement,
          lessonId: row.lesson_id,
          action
        });
      }
    } catch (err: any) {
      result.errors.push({
        line: i + 2,
        row,
        error: err.message
      });
    }
  }

  return result;
}

/**
 * Import local CSV file (default: course24_youtube_links.csv)
 */
export async function importLocalCourse24Csv(customPath?: string): Promise<ImportResult> {
  const possiblePaths = [
    customPath,
    path.join(process.cwd(), '../course24_youtube_links.csv'),
    path.join(process.cwd(), 'course24_youtube_links.csv'),
    'd:\\Kelas Bahasa\\course24_youtube_links.csv'
  ].filter(Boolean) as string[];

  let filePath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    throw new Error('File course24_youtube_links.csv tidak ditemukan di direktori proyek.');
  }

  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const rows = parseYouTubeCsv(csvContent);
  return await importYouTubeVideos(rows, 1, { attachToLessonContent: true });
}
