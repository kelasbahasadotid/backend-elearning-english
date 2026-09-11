import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ChatMessage {
  id: number;
  roomId: number;
  senderId: number;
  senderName: string;
  senderRole: string;
  senderAvatar: string | null;
  message: string;
  attachmentUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ChatRoomDetail {
  id: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  studentAvatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastSenderId: number | null;
  unreadStudentCount: number;
  unreadAdminCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get or create a chat room for a specific student
 */
export async function getOrCreateStudentRoom(studentId: number): Promise<ChatRoomDetail> {
  // 1. Verify student exists
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, full_name, email, avatar FROM users WHERE id = ?`,
    [studentId]
  );
  if (userRows.length === 0) {
    throw new Error(`Student with ID ${studentId} not found`);
  }
  const student = userRows[0];

  // 2. Check if room exists
  const [roomRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, student_id, last_message, last_message_at, last_sender_id,
            unread_student_count, unread_admin_count, status, created_at, updated_at
     FROM chat_rooms
     WHERE student_id = ?`,
    [studentId]
  );

  let roomId: number;
  if (roomRows.length > 0) {
    const r = roomRows[0];
    return {
      id: r.id,
      studentId: r.student_id,
      studentName: student.full_name,
      studentEmail: student.email,
      studentAvatar: student.avatar || null,
      lastMessage: r.last_message,
      lastMessageAt: r.last_message_at ? new Date(r.last_message_at).toISOString() : null,
      lastSenderId: r.last_sender_id,
      unreadStudentCount: Number(r.unread_student_count) || 0,
      unreadAdminCount: Number(r.unread_admin_count) || 0,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString()
    };
  }

  // Create new room
  const [insertRes] = await pool.query<ResultSetHeader>(
    `INSERT INTO chat_rooms (student_id, status) VALUES (?, 'OPEN')`,
    [studentId]
  );
  roomId = insertRes.insertId;

  return {
    id: roomId,
    studentId,
    studentName: student.full_name,
    studentEmail: student.email,
    studentAvatar: student.avatar || null,
    lastMessage: null,
    lastMessageAt: null,
    lastSenderId: null,
    unreadStudentCount: 0,
    unreadAdminCount: 0,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Get conversation messages for a student room
 */
export async function getStudentConversation(
  studentId: number,
  options: { limit?: number; beforeId?: number } = {}
): Promise<{
  room: ChatRoomDetail;
  messages: ChatMessage[];
}> {
  const room = await getOrCreateStudentRoom(studentId);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));

  let whereClause = `WHERE m.room_id = ?`;
  const params: any[] = [room.id];

  if (options.beforeId) {
    whereClause += ` AND m.id < ?`;
    params.push(Number(options.beforeId));
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.room_id, m.sender_id, m.sender_role, m.message, m.attachment_url,
            m.is_read, m.read_at, m.created_at,
            u.full_name as sender_name, u.avatar as sender_avatar
     FROM chat_messages m
     JOIN users u ON m.sender_id = u.id
     ${whereClause}
     ORDER BY m.id DESC
     LIMIT ?`,
    [...params, limit]
  );

  // Return in chronological order
  const messages: ChatMessage[] = (rows as any[]).reverse().map((r) => ({
    id: r.id,
    roomId: r.room_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderRole: r.sender_role,
    senderAvatar: r.sender_avatar || null,
    message: r.message,
    attachmentUrl: r.attachment_url || null,
    isRead: Boolean(r.is_read),
    readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString()
  }));

  return {
    room,
    messages
  };
}

/**
 * Send a chat message (student to admin OR admin to student)
 */
export async function sendChatMessage(params: {
  studentId: number;
  senderId: number;
  senderRole: 'STUDENT' | 'ADMIN' | 'SUPERADMIN' | 'TUTOR';
  message: string;
  attachmentUrl?: string | null;
}): Promise<{
  message: ChatMessage;
  room: ChatRoomDetail;
}> {
  const cleanMessage = params.message?.trim();
  if (!cleanMessage && !params.attachmentUrl) {
    throw new Error('Pesan atau lampiran tidak boleh kosong');
  }

  const room = await getOrCreateStudentRoom(params.studentId);

  // 1. Insert message
  const [insertRes] = await pool.query<ResultSetHeader>(
    `INSERT INTO chat_messages (room_id, sender_id, sender_role, message, attachment_url, is_read)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [
      room.id,
      params.senderId,
      params.senderRole,
      cleanMessage || '',
      params.attachmentUrl || null
    ]
  );
  const messageId = insertRes.insertId;

  // 2. Update room counters and last message
  const isFromStudent = params.senderRole === 'STUDENT';
  await pool.query(
    `UPDATE chat_rooms
     SET last_message = ?,
         last_message_at = NOW(),
         last_sender_id = ?,
         unread_admin_count = unread_admin_count + ?,
         unread_student_count = unread_student_count + ?
     WHERE id = ?`,
    [
      cleanMessage ? cleanMessage.substring(0, 500) : '[Lampiran]',
      params.senderId,
      isFromStudent ? 1 : 0,
      isFromStudent ? 0 : 1,
      room.id
    ]
  );

  // 3. Fetch sender details
  const [senderRows] = await pool.query<RowDataPacket[]>(
    `SELECT full_name, avatar FROM users WHERE id = ?`,
    [params.senderId]
  );
  const sender = senderRows[0] || { full_name: 'User', avatar: null };

  const createdMessage: ChatMessage = {
    id: messageId,
    roomId: room.id,
    senderId: params.senderId,
    senderName: sender.full_name,
    senderRole: params.senderRole,
    senderAvatar: sender.avatar || null,
    message: cleanMessage || '',
    attachmentUrl: params.attachmentUrl || null,
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString()
  };

  const updatedRoom: ChatRoomDetail = {
    ...room,
    lastMessage: createdMessage.message,
    lastMessageAt: createdMessage.createdAt,
    lastSenderId: params.senderId,
    unreadAdminCount: room.unreadAdminCount + (isFromStudent ? 1 : 0),
    unreadStudentCount: room.unreadStudentCount + (isFromStudent ? 0 : 1)
  };

  return {
    message: createdMessage,
    room: updatedRoom
  };
}

/**
 * Mark messages as read
 */
export async function markChatAsRead(params: {
  studentId: number;
  readerRole: 'STUDENT' | 'ADMIN' | 'SUPERADMIN';
}): Promise<{
  roomId: number;
  studentId: number;
  affectedCount: number;
}> {
  const room = await getOrCreateStudentRoom(params.studentId);
  const isStudent = params.readerRole === 'STUDENT';

  let updateQuery = ``;
  let resetRoomCounterQuery = ``;

  if (isStudent) {
    updateQuery = `
      UPDATE chat_messages
      SET is_read = 1, read_at = NOW()
      WHERE room_id = ? AND sender_role != 'STUDENT' AND is_read = 0
    `;
    resetRoomCounterQuery = `UPDATE chat_rooms SET unread_student_count = 0 WHERE id = ?`;
  } else {
    updateQuery = `
      UPDATE chat_messages
      SET is_read = 1, read_at = NOW()
      WHERE room_id = ? AND sender_role = 'STUDENT' AND is_read = 0
    `;
    resetRoomCounterQuery = `UPDATE chat_rooms SET unread_admin_count = 0 WHERE id = ?`;
  }

  const [updateRes] = await pool.query<ResultSetHeader>(updateQuery, [room.id]);
  await pool.query(resetRoomCounterQuery, [room.id]);

  return {
    roomId: room.id,
    studentId: params.studentId,
    affectedCount: updateRes.affectedRows
  };
}

/**
 * List all conversations for Admin / SuperAdmin
 */
export async function getAdminChatConversations(options: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  conversations: ChatRoomDetail[];
  summary: {
    totalConversations: number;
    totalUnreadAdmin: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const offset = (page - 1) * limit;
  const search = options.search?.trim();
  const status = options.status?.trim()?.toUpperCase();

  let whereClause = `WHERE 1=1`;
  const params: any[] = [];

  if (status && status !== 'ALL') {
    whereClause += ` AND r.status = ?`;
    params.push(status);
  }

  if (search) {
    whereClause += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  // Count & unread summary query
  const [summaryRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(r.id) as total_conversations,
            COALESCE(SUM(r.unread_admin_count), 0) as total_unread_admin
     FROM chat_rooms r
     JOIN users u ON r.student_id = u.id
     ${whereClause}`,
    params
  );
  const total = Number(summaryRows[0]?.total_conversations || 0);
  const totalUnreadAdmin = Number(summaryRows[0]?.total_unread_admin || 0);

  // Data query
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.student_id, r.last_message, r.last_message_at, r.last_sender_id,
            r.unread_student_count, r.unread_admin_count, r.status, r.created_at, r.updated_at,
            u.full_name as student_name, u.email as student_email, u.avatar as student_avatar
     FROM chat_rooms r
     JOIN users u ON r.student_id = u.id
     ${whereClause}
     ORDER BY COALESCE(r.last_message_at, r.created_at) DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const conversations: ChatRoomDetail[] = (rows as any[]).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    studentEmail: r.student_email,
    studentAvatar: r.student_avatar || null,
    lastMessage: r.last_message,
    lastMessageAt: r.last_message_at ? new Date(r.last_message_at).toISOString() : null,
    lastSenderId: r.last_sender_id,
    unreadStudentCount: Number(r.unread_student_count) || 0,
    unreadAdminCount: Number(r.unread_admin_count) || 0,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString()
  }));

  return {
    conversations,
    summary: {
      totalConversations: total,
      totalUnreadAdmin
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
