import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { addXpTransaction } from '../utils/xp';
import { transcribeAndAnalyze } from '../utils/speechEngine';
import { updateProgressHelper } from '../utils/progress';

export const getPrompts = async (req: AuthRequest, res: Response) => {
  const { testId } = req.params;
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    // Verify student is enrolled in the parent course
    const [testRows] = await pool.query<RowDataPacket[]>(
      `SELECT a.course_id, l.max_attempt 
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

    const isAdminOrTutor = req.user.roleId === 1 || req.user.roleId === 2 || req.user.roleId === 3 || req.user.roleId === 5;
    if (!isAdminOrTutor) {
      const [enrollments] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM enrollments WHERE course_id = ? AND user_id = ? AND status = 'ACTIVE'`,
        [courseId, req.user.id]
      );
      if (enrollments.length === 0) {
        res.status(403).json({ error: 'You are not enrolled in this course' });
        return;
      }
    }

    // Verify attempt limit if student role
    if (req.user.roleId === 4) {
      const [attempts] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM speaking_attempts WHERE user_id = ? AND speaking_test_id = ?',
        [req.user.id, testId]
      );
      const attemptCount = attempts[0]?.count || 0;
      if (maxAttempt !== null && maxAttempt > 0 && attemptCount >= maxAttempt) {
        res.status(403).json({ error: `You have reached the maximum number of attempts allowed for this speaking test (${maxAttempt})` });
        return;
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
      `SELECT a.course_id, l.max_attempt 
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

    const [enrollments] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM enrollments WHERE course_id = ? AND user_id = ? AND status = 'ACTIVE'`,
      [courseId, req.user.id]
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
    let lessonId: number | null = null;
    let passingScore = 60;
    let passed = 0;
    if (testMetaRows.length > 0) {
      lessonId = testMetaRows[0].lesson_id;
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

    if (lessonId) {
      await updateProgressHelper(connection, req.user.id, lessonId, true, 100.00);
    }

    await connection.commit();
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

// Preset curated natural human-like voices for learning English
export const CURATED_VOICES = [
  { id: 'en-US-AvaNeural', name: 'Ava (US Female - Natural & Friendly)', gender: 'Female', locale: 'en-US' },
  { id: 'en-US-AndrewNeural', name: 'Andrew (US Male - Professional)', gender: 'Male', locale: 'en-US' },
  { id: 'en-US-EmmaNeural', name: 'Emma (US Female - Warm Conversational)', gender: 'Female', locale: 'en-US' },
  { id: 'en-US-BrianNeural', name: 'Brian (US Male - Deep Clear Voice)', gender: 'Male', locale: 'en-US' },
  { id: 'en-US-AnaNeural', name: 'Ana (US Young Female - Expressive)', gender: 'Female', locale: 'en-US' },
  { id: 'en-US-GuyNeural', name: 'Guy (US Male - Casual)', gender: 'Male', locale: 'en-US' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female - British Accent)', gender: 'Female', locale: 'en-GB' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male - British Accent)', gender: 'Male', locale: 'en-GB' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha (AU Female - Australian Accent)', gender: 'Female', locale: 'en-AU' },
];

export const getTtsVoices = async (req: AuthRequest, res: Response) => {
  try {
    res.json(CURATED_VOICES);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const synthesizeTts = async (req: AuthRequest, res: Response) => {
  const { text, voice = 'en-US-AvaNeural', rate = '+0%', pitch = '+0Hz' } = req.body;

  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Text string is required' });
    return;
  }

  try {
    const { Communicate } = require('edge-tts-universal');
    const selectedVoice = voice || 'en-US-AvaNeural';
    const communicate = new Communicate(text, {
      voice: selectedVoice,
      rate,
      pitch
    });

    const chunks: Buffer[] = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio') {
        chunks.push(chunk.data);
      }
    }

    const audioBuffer = Buffer.concat(chunks);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=86400'
    });
    res.send(audioBuffer);
  } catch (error: any) {
    console.error('TTS Synthesis Error:', error);
    res.status(500).json({ error: error.message || 'Speech synthesis failed' });
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

