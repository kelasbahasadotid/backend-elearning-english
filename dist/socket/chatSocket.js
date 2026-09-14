"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChatSocket = initChatSocket;
exports.getSocketIO = getSocketIO;
exports.broadcastChatEvent = broadcastChatEvent;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const chatService_1 = require("../services/chatService");
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key';
let ioInstance = null;
/**
 * Initialize Socket.IO server on top of HTTP server
 */
function initChatSocket(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
        }
    });
    // 1. JWT Authentication Middleware
    io.use((socket, next) => {
        try {
            const auth = socket.handshake.auth || {};
            const headers = socket.handshake.headers || {};
            const query = socket.handshake.query || {};
            let token = auth.token || query.token;
            if (!token && headers.authorization) {
                token = headers.authorization.replace('Bearer ', '').trim();
            }
            if (!token) {
                return next(new Error('Authentication error: Token required'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            const roleId = Number(decoded.roleId || decoded.role_id || decoded.role || 4);
            socket.data.user = {
                id: Number(decoded.id),
                email: decoded.email,
                roleId,
                fullName: decoded.fullName || decoded.full_name || 'User'
            };
            next();
        }
        catch (err) {
            next(new Error(`Authentication error: ${err.message}`));
        }
    });
    // 2. Connection Handler
    io.on('connection', (socket) => {
        const user = socket.data.user;
        const isStudent = user.roleId === 4;
        const isAdmin = user.roleId === 1 || user.roleId === 2;
        // Join personal user room
        socket.join(`user:${user.id}`);
        if (isStudent) {
            // Student joins their dedicated conversation room
            socket.join(`chat:student_${user.id}`);
            console.log(`[ChatSocket] Student connected: ${user.email} (ID: ${user.id}) joined chat:student_${user.id}`);
        }
        else if (isAdmin) {
            // Admin joins global admins channel to monitor all incoming student messages
            socket.join(`chat:admins`);
            console.log(`[ChatSocket] Admin connected: ${user.email} (ID: ${user.id}) joined chat:admins`);
        }
        // Admin joins specific student chat room
        socket.on('join_conversation', (data) => {
            const targetStudentId = Number(data?.studentId);
            if (!targetStudentId)
                return;
            if (isAdmin || user.id === targetStudentId) {
                socket.join(`chat:student_${targetStudentId}`);
                console.log(`[ChatSocket] User ${user.email} joined chat:student_${targetStudentId}`);
            }
        });
        // Leave specific student chat room
        socket.on('leave_conversation', (data) => {
            const targetStudentId = Number(data?.studentId);
            if (!targetStudentId)
                return;
            // Keep student in their own room, admins can leave specific room
            if (isAdmin) {
                socket.leave(`chat:student_${targetStudentId}`);
                console.log(`[ChatSocket] Admin ${user.email} left chat:student_${targetStudentId}`);
            }
        });
        // Send Message Event
        socket.on('send_message', async (data, ack) => {
            try {
                let targetStudentId = user.id;
                let senderRole = 'STUDENT';
                if (isAdmin) {
                    if (!data?.studentId) {
                        throw new Error('studentId wajib disertakan oleh admin saat mengirim pesan');
                    }
                    targetStudentId = Number(data.studentId);
                    senderRole = user.roleId === 1 ? 'SUPERADMIN' : 'ADMIN';
                }
                else {
                    targetStudentId = user.id;
                    senderRole = 'STUDENT';
                }
                const result = await (0, chatService_1.sendChatMessage)({
                    studentId: targetStudentId,
                    senderId: user.id,
                    senderRole,
                    message: data.message,
                    attachmentUrl: data.attachmentUrl
                });
                // Broadcast to student's conversation room (both student & admin listening)
                io.to(`chat:student_${targetStudentId}`).emit('new_message', {
                    studentId: targetStudentId,
                    message: result.message
                });
                // Broadcast updated conversation preview to admin inbox list
                io.to('chat:admins').emit('conversation_updated', {
                    studentId: targetStudentId,
                    room: result.room,
                    lastMessage: result.message
                });
                if (typeof ack === 'function') {
                    ack({ success: true, data: result });
                }
            }
            catch (err) {
                console.error('[ChatSocket] Error handling send_message:', err.message);
                if (typeof ack === 'function') {
                    ack({ success: false, error: err.message });
                }
            }
        });
        // Typing Indicators
        socket.on('typing_start', (data) => {
            const targetStudentId = isAdmin ? Number(data?.studentId) : user.id;
            if (!targetStudentId)
                return;
            socket.to(`chat:student_${targetStudentId}`).emit('user_typing', {
                studentId: targetStudentId,
                userId: user.id,
                fullName: user.fullName,
                isTyping: true
            });
        });
        socket.on('typing_stop', (data) => {
            const targetStudentId = isAdmin ? Number(data?.studentId) : user.id;
            if (!targetStudentId)
                return;
            socket.to(`chat:student_${targetStudentId}`).emit('user_typing', {
                studentId: targetStudentId,
                userId: user.id,
                fullName: user.fullName,
                isTyping: false
            });
        });
        // Mark Read Event
        socket.on('mark_as_read', async (data, ack) => {
            try {
                const targetStudentId = isAdmin ? Number(data?.studentId) : user.id;
                if (!targetStudentId)
                    return;
                const readerRole = isAdmin
                    ? (user.roleId === 1 ? 'SUPERADMIN' : 'ADMIN')
                    : 'STUDENT';
                const result = await (0, chatService_1.markChatAsRead)({
                    studentId: targetStudentId,
                    readerRole
                });
                // Notify room that messages are read
                io.to(`chat:student_${targetStudentId}`).emit('messages_read', {
                    studentId: targetStudentId,
                    readerId: user.id,
                    readerRole
                });
                // Notify admins channel to reset unread badge
                io.to('chat:admins').emit('unread_updated', {
                    studentId: targetStudentId
                });
                if (typeof ack === 'function') {
                    ack({ success: true, data: result });
                }
            }
            catch (err) {
                console.error('[ChatSocket] Error handling mark_as_read:', err.message);
                if (typeof ack === 'function') {
                    ack({ success: false, error: err.message });
                }
            }
        });
        socket.on('disconnect', () => {
            // Clean up
        });
    });
    ioInstance = io;
    console.log('✅ Socket.IO Realtime Chat initialized successfully.');
    return io;
}
/**
 * Get the current Socket.IO instance for server-side broadcasts
 */
function getSocketIO() {
    return ioInstance;
}
/**
 * Helper to broadcast chat message to websocket clients when created via REST API
 */
function broadcastChatEvent(targetStudentId, event, payload) {
    if (!ioInstance)
        return;
    if (event === 'new_message' || event === 'messages_read') {
        ioInstance.to(`chat:student_${targetStudentId}`).emit(event, payload);
    }
    if (event === 'conversation_updated') {
        ioInstance.to('chat:admins').emit('conversation_updated', payload);
    }
}
