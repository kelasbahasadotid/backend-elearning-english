import { Request, Response } from 'express';
import pool from '../config/db';
import { RowDataPacket } from 'mysql2';

export const getNotifications = async (req: Request, res: Response) => {
  const authReq = req as any;
  const userId = authReq.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const [notifications] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, message, is_read, created_at 
       FROM user_notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [userId]
    );

    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const authReq = req as any;
  const userId = authReq.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await pool.query(
      `UPDATE user_notifications 
       SET is_read = 1 
       WHERE user_id = ?`,
      [userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as any;
  const userId = authReq.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await pool.query(
      `UPDATE user_notifications 
       SET is_read = 1 
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    res.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
