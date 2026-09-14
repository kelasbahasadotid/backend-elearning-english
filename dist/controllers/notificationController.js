"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markNotificationRead = exports.markAllNotificationsRead = exports.getNotifications = void 0;
const db_1 = __importDefault(require("../config/db"));
const getNotifications = async (req, res) => {
    const authReq = req;
    const userId = authReq.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const [notifications] = await db_1.default.query(`SELECT id, title, message, is_read, created_at 
       FROM user_notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 100`, [userId]);
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getNotifications = getNotifications;
const markAllNotificationsRead = async (req, res) => {
    const authReq = req;
    const userId = authReq.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        await db_1.default.query(`UPDATE user_notifications 
       SET is_read = 1 
       WHERE user_id = ?`, [userId]);
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.markAllNotificationsRead = markAllNotificationsRead;
const markNotificationRead = async (req, res) => {
    const { id } = req.params;
    const authReq = req;
    const userId = authReq.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        await db_1.default.query(`UPDATE user_notifications 
       SET is_read = 1 
       WHERE id = ? AND user_id = ?`, [id, userId]);
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.markNotificationRead = markNotificationRead;
