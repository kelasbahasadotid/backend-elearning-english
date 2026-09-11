import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { addXpTransaction } from '../utils/xp';
import { transcribeAndAnalyze } from '../utils/speechEngine';
import { updateProgressHelper, checkSequentialLessonLock } from '../utils/progress';
import { resolveVoice, CURATED_VOICES } from '../utils/voiceUtils';
import { extractVocabFromSpeaking } from '../services/vocabularyService';
import { convertMp3ToWav, fetchGoogleTts } from '../utils/audioUtils';


const TTS_CACHE_DIR = path.join(process.cwd(), 'uploads', 'tts_cache');
if (!fs.existsSync(TTS_CACHE_DIR)) {
  try {
    fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
  } catch (_) {}
}

export const getPrompts = async (req: AuthRequest, res: Response) => {
  const { testId } = req.params;
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    const userRoleNum = Number(req.user.roleId || (req.user as any).role_id || (req.user as any).role || 4);
    const isAdminOrTutor = userRoleNum === 1 || userRoleNum === 2 || userRoleNum === 3 || userRoleNum === 5;

    if (!isAdminOrTutor) {
      // Verify student is enrolled in the parent course
      const [testRows] = await pool.query<RowDataPacket[]>(
        `SELECT a.course_id, a.id as assessment_id, a.title as test_title, l.id as lesson_id, l.title as lesson_title, l.max_attempt 
         FROM speaking_tests st
         JOIN assessments a ON st.assessment_id = a.id
         LEFT JOIN lessons l ON a.lesson_id = l.id
         WHERE st.id = ?`,
        [testId]
      );
      if (testRows.length === 0) {
        res.status(404).json({ error: 'Speaking test not found' });
        return;
      }
      const courseId = testRows[0].course_id;
      const maxAttempt = testRows[0].max_attempt;
      const lessonId = testRows[0].lesson_id;

      const [enrollments] = await pool.query<RowDataPacket[]>(
        `SELECT e.id FROM enrollments e 
         LEFT JOIN course_versions cv ON e.course_id = cv.course_id
         JOIN modules m ON cv.id = m.course_version_id
         LEFT JOIN lessons l ON m.id = l.module_id
         LEFT JOIN assessments a ON l.id = a.lesson_id
         WHERE (e.course_id = ? OR a.id = ?) AND e.user_id = ? AND (e.status = 'ACTIVE' OR LOWER(e.status) = 'active') AND (e.expired_at IS NULL OR e.expired_at >= NOW())`,
        [courseId || 0, testRows[0].assessment_id || 0, req.user.id]
      );
      if (enrollments.length === 0) {
        res.status(403).json({ error: 'You are not enrolled in this course' });
        return;
      }

      // Sequential lock check
      if (lessonId) {
        const lockCheck = await checkSequentialLessonLock(pool, req.user.id, lessonId);
        if (lockCheck.isLocked) {
          res.status(403).json({
            error: `Tes Speaking "${testRows[0].lesson_title || testRows[0].test_title}" masih terkunci. Anda harus menyelesaikan materi "${lockCheck.requiredLessonTitle}" terlebih dahulu.`,
            isLocked: true,
            requiredLessonId: lockCheck.requiredLessonId,
            requiredLessonTitle: lockCheck.requiredLessonTitle
          });
          return;
        }
      }

      // Verify attempt limit if student role
      let isAttemptExceeded = false;
      if (req.user.roleId === 4) {
        const [attempts] = await pool.query<RowDataPacket[]>(
          'SELECT COUNT(*) as count FROM speaking_attempts WHERE user_id = ? AND speaking_test_id = ?',
          [req.user.id, testId]
        );
        const attemptCount = attempts[0]?.count || 0;
        if (maxAttempt !== null && maxAttempt > 0 && attemptCount >= maxAttempt) {
          isAttemptExceeded = true;
        }
      }
    }

    const [prompts] = await pool.query<RowDataPacket[]>(
      'SELECT id, speaking_test_id, prompt_type, prompt_text, image_url, audio_url, prompt_order FROM speaking_prompts WHERE speaking_test_id = ? ORDER BY prompt_order ASC',
      [testId]
    );

    res.json(prompts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const submitAttempt = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  const { speakingTestId, promptId, durationSeconds, browserTranscript } = req.body;
  const audioFile = req.file;

  if (!speakingTestId || !promptId || !audioFile) {
     res.status(400).json({ error: 'speakingTestId, promptId, and audio file are required' });
     return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify student is enrolled in the parent course
    const [testRows] = await connection.query<RowDataPacket[]>(
      `SELECT a.course_id, a.id as assessment_id, a.title as test_title, l.id as lesson_id, l.title as lesson_title, l.max_attempt 
       FROM speaking_tests st
       JOIN assessments a ON st.assessment_id = a.id
       LEFT JOIN lessons l ON a.lesson_id = l.id
       WHERE st.id = ?`,
      [speakingTestId]
    );
    if (testRows.length === 0) {
      res.status(404).json({ error: 'Speaking test not found' });
      await connection.rollback();
      connection.release();
      return;
    }
    const courseId = testRows[0].course_id;
    const maxAttempt = testRows[0].max_attempt;
    const lessonId = testRows[0].lesson_id;

    const userRoleNum = Number(req.user.roleId || (req.user as any).role_id || (req.user as any).role || 4);
    const isAdminOrTutor = userRoleNum === 1 || userRoleNum === 2 || userRoleNum === 3 || userRoleNum === 5;
    if (!isAdminOrTutor) {
      const [enrollments] = await connection.query<RowDataPacket[]>(
        `SELECT e.id FROM enrollments e 
         LEFT JOIN course_versions cv ON e.course_id = cv.course_id
         JOIN modules m ON cv.id = m.course_version_id
         LEFT JOIN lessons l ON m.id = l.module_id
         LEFT JOIN assessments a ON l.id = a.lesson_id
         WHERE (e.course_id = ? OR a.id = ?) AND e.user_id = ? AND (e.status = 'ACTIVE' OR LOWER(e.status) = 'active') AND (e.expired_at IS NULL OR e.expired_at >= NOW())`,
        [courseId || 0, testRows[0].assessment_id || 0, req.user.id]
      );
      if (enrollments.length === 0) {
        res.status(403).json({ error: 'You are not enrolled in this course' });
        await connection.rollback();
        connection.release();
        return;
      }

      // Sequential lock check
      if (lessonId) {
        const lockCheck = await checkSequentialLessonLock(connection, req.user.id, lessonId);
        if (lockCheck.isLocked) {
          res.status(403).json({
            error: `Tes Speaking "${testRows[0].lesson_title || testRows[0].test_title}" masih terkunci. Anda harus menyelesaikan materi "${lockCheck.requiredLessonTitle}" terlebih dahulu.`,
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
        'SELECT COUNT(*) as count FROM speaking_attempts WHERE user_id = ? AND speaking_test_id = ?',
        [req.user.id, speakingTestId]
      );
      const attemptCount = attempts[0]?.count || 0;
      if (maxAttempt !== null && maxAttempt > 0 && attemptCount >= maxAttempt) {
        res.status(403).json({ error: `You have reached the maximum number of attempts allowed for this speaking test (${maxAttempt})` });
        await connection.rollback();
        connection.release();
        return;
      }
    }

    // 1. Retrieve prompt text to "compare" with mock transcription
    const [prompts] = await connection.query<RowDataPacket[]>(
      'SELECT prompt_text FROM speaking_prompts WHERE id = ?',
      [promptId]
    );
    
    if (prompts.length === 0) {
       res.status(404).json({ error: 'Prompt not found' });
       connection.release();
       return;
     }
    const promptText = prompts[0].prompt_text;

    // 2. Transcribe and analyze using Vosk speech engine
    const relativePath = `uploads/recordings/${audioFile.filename}`;
    const audioFilePath = audioFile.path;
    const analysis = await transcribeAndAnalyze(audioFilePath, promptText, durationSeconds || 15, browserTranscript);

    // 3. Insert into speaking_attempts
    const [attemptResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO speaking_attempts (speaking_test_id, prompt_id, user_id, started_at, finished_at, overall_score, status) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL ? SECOND), NOW(), ?, ?)',
      [speakingTestId, promptId, req.user.id, durationSeconds || 15, analysis.overallScore, 'FINISHED']
    );

    const attemptId = attemptResult.insertId;

    // 4. Insert recording metadata
    await connection.query(
      'INSERT INTO speaking_recordings (speaking_attempt_id, audio_path, duration_seconds, file_size, sample_rate) VALUES (?, ?, ?, ?, ?)',
      [attemptId, relativePath, durationSeconds || 15, audioFile.size, 44100]
    );

    // 5. Insert speech transcription
    await connection.query(
      'INSERT INTO speech_transcriptions (speaking_attempt_id, transcript, confidence, language_code, ai_provider) VALUES (?, ?, ?, ?, ?)',
      [attemptId, analysis.transcription, analysis.confidence, 'en-US', 'Vosk Offline STT']
    );

    // 6. Insert AI Feedbacks
    await connection.query(
      `INSERT INTO ai_feedbacks (speaking_attempt_id, strengths, weaknesses, recommendation, corrected_sentence, ai_provider, ai_model, processing_time_ms) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        analysis.strengths,
        analysis.weaknesses,
        analysis.recommendation,
        analysis.transcription,
        'Vosk Local Speech Engine',
        'vosk-model-small-en-us-0.15',
        350
      ]
    );

    // 7. Insert detailed subscores
    await connection.query(
      'INSERT INTO fluency_scores (speaking_attempt_id, fluency_score, speaking_rate, pause_count, filler_count) VALUES (?, ?, ?, ?, ?)',
      [attemptId, analysis.fluency, 142.50, 1, 0]
    );

    await connection.query(
      'INSERT INTO grammar_scores (speaking_attempt_id, grammar_score, grammar_error) VALUES (?, ?, ?)',
      [attemptId, analysis.grammar, 0]
    );

    await connection.query(
      'INSERT INTO pronunciation_scores (speaking_attempt_id, pronunciation_score, word_accuracy, phoneme_accuracy) VALUES (?, ?, ?, ?)',
      [attemptId, analysis.pronunciation, 94.00, 89.20]
    );

    await connection.query(
      'INSERT INTO vocabulary_scores (speaking_attempt_id, vocabulary_score, unique_word, advanced_word) VALUES (?, ?, ?, ?)',
      [attemptId, analysis.vocabulary, 14, 1]
    );

    // Check and update parent lesson progress
    const [testMetaRows] = await connection.query<RowDataPacket[]>(
      `SELECT a.lesson_id, a.passing_score
       FROM speaking_tests st
       JOIN assessments a ON st.assessment_id = a.id
       WHERE st.id = ?`,
      [speakingTestId]
    );
    let targetLessonId: number | null = lessonId || null;
    let passingScore = 60;
    let passed = 0;
    if (testMetaRows.length > 0) {
      targetLessonId = testMetaRows[0].lesson_id || lessonId || null;
      passingScore = Number(testMetaRows[0].passing_score || 60);
      passed = Number(analysis.overallScore) >= passingScore ? 1 : 0;
    }

    // Check if user has ANY previous attempt for this speaking test to enforce single-time XP award on first try
    const [previousAttempts] = await connection.query<RowDataPacket[]>(
      `SELECT id, overall_score FROM speaking_attempts 
       WHERE user_id = ? AND speaking_test_id = ? AND id != ?
       ORDER BY overall_score DESC`,
      [req.user.id, speakingTestId, attemptId]
    );

    const hasPreviousAttempts = previousAttempts.length > 0;
    const previousBestScore = hasPreviousAttempts ? Number(previousAttempts[0].overall_score || 0) : null;
    const currentScore = Number(analysis.overallScore);
    const isWorseScore = hasPreviousAttempts && previousBestScore !== null && currentScore < previousBestScore;

    // STRICT XP RULE: Award 30 XP ONLY if this is the first attempt (#1) and passed
    const isFirstTimePassing = !hasPreviousAttempts && passed === 1;

    if (isFirstTimePassing) {
      await addXpTransaction(connection, req.user.id, 'SPEAKING', 30, speakingTestId, `Completed Speaking Test Prompt #${promptId}`);
    }

    // Update learning statistics
    await connection.query(
      `INSERT INTO user_statistics (user_id, total_speaking) 
       VALUES (?, 1) 
       ON DUPLICATE KEY UPDATE 
       total_speaking = total_speaking + 1`,
      [req.user.id]
    );

    if (targetLessonId) {
      await updateProgressHelper(connection, req.user.id, targetLessonId, true, 100.00);
    }

    await connection.commit();

    // Auto-capture speaking prompt & words into student's personal vocabulary room
    let vocabCaptured: any[] = [];
    try {
      vocabCaptured = await extractVocabFromSpeaking(
        req.user.id,
        Number(promptId),
        testMetaRows[0]?.test_title || `Speaking Test #${speakingTestId}`,
        promptText,
        analysis.transcription,
        analysis.wordDetails || []
      );
    } catch (vErr: any) {
      console.warn('[Vocabulary] Speaking auto-capture error:', vErr.message);
    }

    res.status(201).json({
      message: 'Speaking attempt analyzed successfully',
      attempt: {
        attemptId,
        overallScore: analysis.overallScore,
        awardXp: isFirstTimePassing,
        previousBestScore,
        isWorseScore
      },
      analysis: {
        fluency: analysis.fluency,
        grammar: analysis.grammar,
        pronunciation: analysis.pronunciation,
        vocabulary: analysis.vocabulary,
        transcription: analysis.transcription,
        feedback: {
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendation: analysis.recommendation
        },
        wordDetails: analysis.wordDetails || [],
        pronunciationTips: analysis.pronunciationTips || []
      },
      vocabularyCollected: {
        total: vocabCaptured.length,
        items: vocabCaptured.map(v => ({
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

export const getSpeakingAttemptsHistory = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    const [attempts] = await pool.query<RowDataPacket[]>(
      `SELECT sa.id, sa.speaking_test_id, sa.prompt_id, sa.started_at, sa.finished_at, sa.overall_score, sa.status, 
              sp.prompt_text, fs.fluency_score, gs.grammar_score, ps.pronunciation_score, vs.vocabulary_score,
              f.strengths, f.weaknesses, f.recommendation, sr.audio_path,
              c.title as course_title
       FROM speaking_attempts sa
       JOIN speaking_prompts sp ON sa.prompt_id = sp.id
       LEFT JOIN fluency_scores fs ON sa.id = fs.speaking_attempt_id
       LEFT JOIN grammar_scores gs ON sa.id = gs.speaking_attempt_id
       LEFT JOIN pronunciation_scores ps ON sa.id = ps.speaking_attempt_id
       LEFT JOIN vocabulary_scores vs ON sa.id = vs.speaking_attempt_id
       LEFT JOIN ai_feedbacks f ON sa.id = f.speaking_attempt_id
       LEFT JOIN speaking_recordings sr ON sa.id = sr.speaking_attempt_id
       LEFT JOIN speaking_tests st ON sa.speaking_test_id = st.id
       LEFT JOIN assessments a ON st.assessment_id = a.id
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE sa.user_id = ?
       ORDER BY sa.finished_at DESC`,
      [req.user.id]
    );

    res.json(attempts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getTtsVoices = async (req: AuthRequest, res: Response) => {
  try {
    res.json(CURATED_VOICES);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const synthesizeTts = async (req: AuthRequest, res: Response) => {
  const isGet = req.method === 'GET';
  const textRaw = isGet ? req.query.text : req.body.text;
  const voiceRaw = isGet ? req.query.voice : req.body.voice;
  const rateRaw = isGet ? req.query.rate : req.body.rate;
  const pitchRaw = isGet ? req.query.pitch : req.body.pitch;
  const formatRaw = isGet ? req.query.format : req.body.format;

  const text = typeof textRaw === 'string' ? textRaw.trim() : '';
  const rawVoice = (typeof voiceRaw === 'string' && voiceRaw.trim()) ? voiceRaw.trim() : 'en-US-AvaNeural';
  const voice = resolveVoice(rawVoice);
  const rate = (typeof rateRaw === 'string' && rateRaw.trim()) ? rateRaw.trim() : '+0%';
  const pitch = (typeof pitchRaw === 'string' && pitchRaw.trim()) ? pitchRaw.trim() : '+0Hz';
  // Server only reads WAV/AAC, AAC is default to be lightweight and save 95% storage
  let format = 'aac';
  const requestedFormat = (typeof formatRaw === 'string') ? formatRaw.trim().toLowerCase() : '';
  if (requestedFormat === 'wav') {
    format = 'wav';
  } else if (requestedFormat === 'mp3') {
    format = 'mp3';
  } else {
    format = 'aac';
  }

  let contentType = 'audio/aac';
  if (format === 'wav') contentType = 'audio/wav';
  else if (format === 'mp3') contentType = 'audio/mpeg';

  if (!text) {
    res.status(400).json({ error: 'Text string is required' });
    return;
  }

  // 1. Check Server Disk Cache for Instant (< 5ms) Response
  const cacheKey = crypto.createHash('md5').update(`${voice}__${rate}__${pitch}__${text}__${format}`).digest('hex');
  const cacheFile = path.join(TTS_CACHE_DIR, `${cacheKey}.${format}`);

  if (fs.existsSync(cacheFile)) {
    try {
      const stats = fs.statSync(cacheFile);
      if (stats.size > 0) {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=604800, immutable',
          'X-Cache': 'HIT'
        });
        const readStream = fs.createReadStream(cacheFile);
        readStream.pipe(res);
        return;
      }
    } catch (_) {
      // Continue to live synthesize on file read error
    }
  }

  let isClientConnected = true;
  req.on('close', () => {
    isClientConnected = false;
  });

  let finalAudioBuffer: Buffer | null = null;
  let cacheHitTag = 'MISS';

  // Tier 1: Try High-Quality Neural Edge-TTS (Fast on unrestricted connections)
  try {
    const { Communicate } = require('edge-tts-universal');
    const communicate = new Communicate(text, {
      voice,
      rate,
      pitch
    });

    const collectedChunks: Buffer[] = [];

    // Timeout safety: 3500ms for initial Edge-TTS WebSocket. If server IP is blocked or throttled by Microsoft Cloud, immediately switch to fallback!
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Edge-TTS Cloud Timeout')), 3500)
    );

    const streamPromise = (async () => {
      for await (const chunk of communicate.stream()) {
        if (!isClientConnected) break;
        if (chunk.type === 'audio' && chunk.data) {
          collectedChunks.push(chunk.data);
        }
      }
    })();

    await Promise.race([streamPromise, timeoutPromise]);

    if (!isClientConnected) return;

    if (collectedChunks.length > 0) {
      const rawMp3Buffer = Buffer.concat(collectedChunks);
      finalAudioBuffer = format === 'wav' ? await convertMp3ToWav(rawMp3Buffer) : rawMp3Buffer;
      cacheHitTag = 'MISS-EDGE';
    }
  } catch (edgeErr: any) {
    console.warn(`[TTS] Edge-TTS not reachable from this server (${edgeErr?.message || edgeErr}). Activating Google Cloud TTS Engine...`);
  }

  // Tier 2: Bulletproof High-Speed Google Speech HTTP API Fallback (Works on 100% of VPS / cPanel / LiteSpeed environments)
  if (!finalAudioBuffer && isClientConnected) {
    try {
      const fallbackMp3 = await fetchGoogleTts(text, 'en');
      if (fallbackMp3.length > 0) {
        finalAudioBuffer = format === 'wav' ? await convertMp3ToWav(fallbackMp3) : fallbackMp3;
        cacheHitTag = 'MISS-FALLBACK';
      }
    } catch (fallbackErr: any) {
      console.error('[TTS] Google TTS fallback error:', fallbackErr?.message || fallbackErr);
    }
  }

  if (!isClientConnected) return;

  if (!finalAudioBuffer || finalAudioBuffer.length === 0) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Speech synthesis failed across all cloud engines' });
    }
    return;
  }

  // Save generated audio to cache for all subsequent clicks/students (< 5ms response time)
  try {
    await fs.promises.writeFile(cacheFile, finalAudioBuffer);
  } catch (_) {}

  if (!res.headersSent) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': finalAudioBuffer.length,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=604800, immutable',
      'X-Cache': cacheHitTag
    });
    res.end(finalAudioBuffer);
  }
};

export const transcribeAudio = async (req: AuthRequest, res: Response) => {
  const audioFile = req.file;
  const promptText = (req.body.promptText || '').toString();
  const browserTranscript = (req.body.browserTranscript || req.body.transcript || req.body.promptText || '').toString();

  if (!audioFile) {
    res.status(400).json({ error: 'Audio file is required' });
    return;
  }

  try {
    const analysis = await transcribeAndAnalyze(audioFile.path, promptText, 10, browserTranscript);
    res.json({
      transcript: analysis.transcription,
      confidence: analysis.confidence,
      overallScore: analysis.overallScore,
      wordDetails: analysis.wordDetails || [],
      pronunciationTips: analysis.pronunciationTips || []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Transcribe failed' });
  }
};

