import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';

export const getStudentSubmissions = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sa.id, sa.started_at, sa.finished_at, sa.overall_score as score, sa.status, 
              u.full_name as studentName, sp.prompt_text as promptText, f.recommendation as feedback,
              fl.fluency_score as fluency, pr.pronunciation_score as pronunciation
       FROM speaking_attempts sa
       JOIN users u ON sa.user_id = u.id
       JOIN speaking_prompts sp ON sa.prompt_id = sp.id
       LEFT JOIN ai_feedbacks f ON sa.id = f.speaking_attempt_id
       LEFT JOIN fluency_scores fl ON sa.id = fl.speaking_attempt_id
       LEFT JOIN pronunciation_scores pr ON sa.id = pr.speaking_attempt_id
       ORDER BY sa.finished_at DESC`
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const submitTutorReview = async (req: AuthRequest, res: Response) => {
  const { attemptId } = req.params;
  const { feedback } = req.body;
  
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  if (!feedback) {
    res.status(400).json({ error: 'Feedback text is required' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM ai_feedbacks WHERE speaking_attempt_id = ?',
      [attemptId]
    );

    if (existing.length > 0) {
      await connection.query(
        `UPDATE ai_feedbacks 
         SET recommendation = ?, strengths = 'Tutor Evaluated', weaknesses = 'Tutor Evaluated', ai_provider = 'Tutor User' 
         WHERE speaking_attempt_id = ?`,
        [feedback, attemptId]
      );
    } else {
      await connection.query(
        `INSERT INTO ai_feedbacks (speaking_attempt_id, strengths, weaknesses, recommendation, ai_provider, ai_model, processing_time_ms) 
         VALUES (?, 'Tutor Evaluated', 'Tutor Evaluated', ?, 'Tutor User', 'Tutor Feedback', 0)`,
        [attemptId, feedback]
      );
    }

    await connection.commit();
    res.json({ message: 'Tutor review submitted successfully' });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    connection.release();
  }
};
