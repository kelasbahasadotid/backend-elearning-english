import { Request, Response } from 'express';
import {
  getStudentConversation,
  sendChatMessage,
  markChatAsRead,
  getAdminChatConversations
} from '../services/chatService';
import { broadcastChatEvent } from '../socket/chatSocket';

/**
 * GET /api/chat/my-conversation
 * Student fetches their own conversation thread and messages
 */
export async function getMyConversation(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { limit, beforeId } = req.query;
    const conversation = await getStudentConversation(Number(userId), {
      limit: limit ? Number(limit) : 50,
      beforeId: beforeId ? Number(beforeId) : undefined
    });

    res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error: any) {
    console.error('[ChatController] Error fetching my conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation',
      message: error.message
    });
  }
}

/**
 * POST /api/chat/messages
 * Student sends a message to Admin/Superadmin
 */
export async function sendStudentMessage(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { message, attachmentUrl } = req.body;
    const result = await sendChatMessage({
      studentId: Number(userId),
      senderId: Number(userId),
      senderRole: 'STUDENT',
      message,
      attachmentUrl
    });

    // Realtime broadcast via Socket.IO
    broadcastChatEvent(Number(userId), 'new_message', {
      studentId: Number(userId),
      message: result.message
    });
    broadcastChatEvent(Number(userId), 'conversation_updated', {
      studentId: Number(userId),
      room: result.room,
      lastMessage: result.message
    });

    res.status(201).json({
      success: true,
      message: 'Pesan berhasil dikirim',
      data: result
    });
  } catch (error: any) {
    console.error('[ChatController] Error sending student message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      message: error.message
    });
  }
}

/**
 * PUT /api/chat/read
 * Student marks admin messages as read
 */
export async function markMyChatRead(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await markChatAsRead({
      studentId: Number(userId),
      readerRole: 'STUDENT'
    });

    // Broadcast read event to socket
    broadcastChatEvent(Number(userId), 'messages_read', {
      studentId: Number(userId),
      readerId: Number(userId),
      readerRole: 'STUDENT'
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[ChatController] Error marking chat as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark chat as read',
      message: error.message
    });
  }
}

/**
 * GET /api/admin/chat/conversations
 * Admin lists all student chat conversations with unread counter and search
 */
export async function getAdminConversationsList(req: Request, res: Response): Promise<void> {
  try {
    const { search, status, page, limit } = req.query;
    const result = await getAdminChatConversations({
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    });

    res.status(200).json({
      success: true,
      data: result.conversations,
      summary: result.summary,
      pagination: result.pagination
    });
  } catch (error: any) {
    console.error('[ChatController] Error fetching admin conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      message: error.message
    });
  }
}

/**
 * GET /api/admin/chat/conversations/:studentId/messages
 * Admin opens a specific student conversation thread
 */
export async function getStudentConversationAdmin(req: Request, res: Response): Promise<void> {
  const { studentId } = req.params;
  try {
    const { limit, beforeId } = req.query;
    const conversation = await getStudentConversation(Number(studentId), {
      limit: limit ? Number(limit) : 50,
      beforeId: beforeId ? Number(beforeId) : undefined
    });

    res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (error: any) {
    console.error('[ChatController] Error fetching conversation for admin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation',
      message: error.message
    });
  }
}

/**
 * POST /api/admin/chat/conversations/:studentId/messages
 * Admin sends a reply message to a student
 */
export async function sendAdminMessage(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const { studentId } = req.params;

  if (!user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { message, attachmentUrl } = req.body;
    const senderRole = user.roleId === 1 || user.role_id === 1 ? 'SUPERADMIN' : 'ADMIN';

    const result = await sendChatMessage({
      studentId: Number(studentId),
      senderId: Number(user.id),
      senderRole,
      message,
      attachmentUrl
    });

    // Broadcast to student room
    broadcastChatEvent(Number(studentId), 'new_message', {
      studentId: Number(studentId),
      message: result.message
    });
    // Broadcast to admin channel
    broadcastChatEvent(Number(studentId), 'conversation_updated', {
      studentId: Number(studentId),
      room: result.room,
      lastMessage: result.message
    });

    res.status(201).json({
      success: true,
      message: 'Balasan pesan berhasil dikirim ke siswa',
      data: result
    });
  } catch (error: any) {
    console.error('[ChatController] Error sending admin reply:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send reply',
      message: error.message
    });
  }
}

/**
 * PUT /api/admin/chat/conversations/:studentId/read
 * Admin marks student messages as read
 */
export async function markAdminChatRead(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const { studentId } = req.params;

  if (!user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const readerRole = user.roleId === 1 || user.role_id === 1 ? 'SUPERADMIN' : 'ADMIN';
    const result = await markChatAsRead({
      studentId: Number(studentId),
      readerRole
    });

    // Broadcast read event to socket
    broadcastChatEvent(Number(studentId), 'messages_read', {
      studentId: Number(studentId),
      readerId: Number(user.id),
      readerRole
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[ChatController] Error marking chat read by admin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark chat as read',
      message: error.message
    });
  }
}
