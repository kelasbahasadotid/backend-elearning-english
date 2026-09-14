"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRoundcubeEmails = exports.deleteEmailMessage = exports.updateMessageFolder = exports.createOrSendEmailMessage = exports.getEmailMessages = exports.testSmtpConnection = exports.saveEmailSettings = exports.getEmailSettings = exports.getSmtpConfig = exports.ensureEmailTables = void 0;
const db_1 = __importDefault(require("../config/db"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const imap_simple_1 = __importDefault(require("imap-simple"));
const mailparser_1 = require("mailparser");
/**
 * Auto-ensure email_messages database table structure
 */
const ensureEmailTables = async () => {
    try {
        await db_1.default.query(`
      CREATE TABLE IF NOT EXISTS email_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_email VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        recipient_name VARCHAR(255) NULL,
        subject VARCHAR(255) NOT NULL,
        body_html LONGTEXT NOT NULL,
        body_text TEXT NULL,
        folder ENUM('INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH') NOT NULL DEFAULT 'INBOX',
        status ENUM('UNREAD', 'READ', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'READ',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
        // Seed default inbox / sent sample messages if empty
        const [rows] = await db_1.default.query('SELECT COUNT(*) as count FROM email_messages');
        if (rows[0]?.count === 0) {
            await db_1.default.query(`
        INSERT INTO email_messages (sender_email, sender_name, recipient_email, recipient_name, subject, body_html, folder, status) VALUES
        ('support@erwinsyahrudin.online', 'System Notification', 'student@example.com', 'System Log', 'Selamat Datang di Hub Manajemen Email LMS', '<p>Sistem Manajemen Email LMS telah aktif. Anda dapat mengelola SMTP server, draf email, folder spam, dan mengirimkan email langsung ke siswa.</p>', 'INBOX', 'READ'),
        ('support@erwinsyahrudin.online', 'E-Learning Support', 'siswa.paket1@example.com', 'Siswa Test 1', '🎉 Akses Kelas Aktif: Paket 1 E-learning + TOEFL', '<p>Halo Siswa Test 1, Akun siswa Anda sudah aktif dan siap digunakan untuk mulai belajar.</p>', 'SENT', 'SENT')
      `);
        }
    }
    catch (err) {
        if (err.code !== 'ECONNREFUSED') {
            console.error('[Email DB Init Error]', err.message || err);
        }
    }
};
exports.ensureEmailTables = ensureEmailTables;
/**
 * Helper: Fetch current SMTP Settings
 */
const getSmtpConfig = async () => {
    let host = process.env.SMTP_HOST || 'mail.erwinsyahrudin.online';
    let port = Number(process.env.SMTP_PORT) || 465;
    let user = process.env.SMTP_USER || 'support@erwinsyahrudin.online';
    let pass = process.env.SMTP_PASS || '';
    let fromEmail = process.env.SMTP_FROM || 'support@erwinsyahrudin.online';
    let fromName = process.env.SMTP_FROM_NAME || 'E-Learning English Support';
    try {
        const [rows] = await db_1.default.query('SELECT key_name, value FROM platform_settings WHERE key_name LIKE "smtp_%"');
        for (const r of rows) {
            if (r.key_name === 'smtp_host' && r.value)
                host = r.value;
            if (r.key_name === 'smtp_port' && r.value)
                port = Number(r.value);
            if (r.key_name === 'smtp_user' && r.value)
                user = r.value;
            if (r.key_name === 'smtp_pass' && r.value)
                pass = r.value;
            if (r.key_name === 'smtp_from' && r.value)
                fromEmail = r.value;
            if (r.key_name === 'smtp_from_name' && r.value)
                fromName = r.value;
        }
    }
    catch (err) {
        // Fallback to env
    }
    return { host, port, user, pass, fromEmail, fromName };
};
exports.getSmtpConfig = getSmtpConfig;
/**
 * GET /api/admin/emails/settings
 */
const getEmailSettings = async (req, res) => {
    try {
        await (0, exports.ensureEmailTables)();
        const config = await (0, exports.getSmtpConfig)();
        res.json({
            smtpHost: config.host,
            smtpPort: config.port,
            smtpUser: config.user,
            smtpPass: config.pass,
            smtpFrom: config.fromEmail,
            smtpFromName: config.fromName
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch email settings' });
    }
};
exports.getEmailSettings = getEmailSettings;
/**
 * POST /api/admin/emails/settings
 */
const saveEmailSettings = async (req, res) => {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, smtpFromName } = req.body;
    try {
        await (0, exports.ensureEmailTables)();
        const settings = [
            { key: 'smtp_host', val: smtpHost },
            { key: 'smtp_port', val: String(smtpPort || 465) },
            { key: 'smtp_user', val: smtpUser },
            { key: 'smtp_pass', val: smtpPass },
            { key: 'smtp_from', val: smtpFrom },
            { key: 'smtp_from_name', val: smtpFromName }
        ];
        for (const s of settings) {
            await db_1.default.query('INSERT INTO platform_settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', [s.key, s.val || '', s.val || '']);
        }
        // Update runtime env
        if (smtpHost)
            process.env.SMTP_HOST = smtpHost;
        if (smtpPort)
            process.env.SMTP_PORT = String(smtpPort);
        if (smtpUser)
            process.env.SMTP_USER = smtpUser;
        if (smtpPass)
            process.env.SMTP_PASS = smtpPass;
        if (smtpFrom)
            process.env.SMTP_FROM = smtpFrom;
        if (smtpFromName)
            process.env.SMTP_FROM_NAME = smtpFromName;
        res.json({ message: 'Pengaturan SMTP berhasil diperbarui!' });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Gagal menyimpan pengaturan SMTP' });
    }
};
exports.saveEmailSettings = saveEmailSettings;
/**
 * POST /api/admin/emails/test-smtp
 */
const testSmtpConnection = async (req, res) => {
    const { testRecipient } = req.body;
    if (!testRecipient) {
        res.status(400).json({ error: 'Email penerima tes wajib diisi' });
        return;
    }
    try {
        const config = await (0, exports.getSmtpConfig)();
        if (!config.user || !config.pass) {
            res.status(400).json({ error: 'Password & Username SMTP belum diisi di konfigurasi' });
            return;
        }
        const transporter = nodemailer_1.default.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
                user: config.user,
                pass: config.pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        const info = await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: testRecipient,
            subject: '🧪 Uji Coba Server Email SMTP LMS',
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #E2E8F0; border-radius: 12px; max-width: 500px;">
          <h2 style="color: #EAB308;">✅ Uji Coba SMTP Berhasil!</h2>
          <p>Email ini dikirimkan secara otomatis untuk memverifikasi bahwa konfigurasi server SMTP <b>${config.host}</b> pada platform LMS telah berfungsi dengan baik.</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 15px 0;" />
          <p style="font-size: 12px; color: #64748B;">Waktu Pengujian: ${new Date().toLocaleString('id-ID')}</p>
        </div>
      `
        });
        // Record in sent messages
        await db_1.default.query('INSERT INTO email_messages (sender_email, sender_name, recipient_email, recipient_name, subject, body_html, folder, status) VALUES (?, ?, ?, ?, ?, ?, "SENT", "SENT")', [config.fromEmail, config.fromName, testRecipient, 'Test Recipient', '🧪 Uji Coba Server Email SMTP LMS', 'Uji coba SMTP Berhasil', 'SENT', 'SENT']);
        res.json({ success: true, message: `Email uji coba berhasil dikirim ke ${testRecipient}! MessageId: ${info.messageId || 'Success'}` });
    }
    catch (err) {
        res.status(500).json({ error: `Gagal mengirim email tes SMTP: ${err.message}` });
    }
};
exports.testSmtpConnection = testSmtpConnection;
/**
 * GET /api/admin/emails/messages
 */
const getEmailMessages = async (req, res) => {
    const folder = (req.query.folder || 'INBOX').toUpperCase();
    const search = req.query.search || '';
    try {
        await (0, exports.ensureEmailTables)();
        let query = 'SELECT * FROM email_messages WHERE folder = ?';
        const params = [folder];
        if (search) {
            query += ' AND (subject LIKE ? OR recipient_email LIKE ? OR sender_email LIKE ? OR body_html LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }
        query += ' ORDER BY created_at DESC';
        const [messages] = await db_1.default.query(query, params);
        // Get unread count for badges
        const [counts] = await db_1.default.query(`
      SELECT folder, COUNT(*) as count FROM email_messages GROUP BY folder
    `);
        const folderCounts = { INBOX: 0, SENT: 0, DRAFT: 0, SPAM: 0, TRASH: 0 };
        for (const c of counts) {
            folderCounts[c.folder] = c.count;
        }
        res.json({
            messages,
            counts: folderCounts
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Gagal mengambil daftar email' });
    }
};
exports.getEmailMessages = getEmailMessages;
/**
 * POST /api/admin/emails/messages (Compose / Send / Save Draft)
 */
const createOrSendEmailMessage = async (req, res) => {
    const { recipientEmail, recipientName, subject, bodyHtml, action } = req.body;
    if (!recipientEmail || !subject) {
        res.status(400).json({ error: 'Penerima email dan Subjek wajib diisi' });
        return;
    }
    try {
        await (0, exports.ensureEmailTables)();
        const config = await (0, exports.getSmtpConfig)();
        const isDraft = action === 'DRAFT';
        const targetFolder = isDraft ? 'DRAFT' : 'SENT';
        if (!isDraft) {
            // Send live email via SMTP
            if (config.user && config.pass) {
                const transporter = nodemailer_1.default.createTransport({
                    host: config.host,
                    port: config.port,
                    secure: config.port === 465,
                    auth: { user: config.user, pass: config.pass },
                    tls: { rejectUnauthorized: false }
                });
                await transporter.sendMail({
                    from: `"${config.fromName}" <${config.fromEmail}>`,
                    to: recipientEmail,
                    subject,
                    html: bodyHtml || `<p>${subject}</p>`
                });
            }
        }
        const [result] = await db_1.default.query('INSERT INTO email_messages (sender_email, sender_name, recipient_email, recipient_name, subject, body_html, folder, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [config.fromEmail, config.fromName, recipientEmail, recipientName || '', subject, bodyHtml || '', targetFolder, isDraft ? 'READ' : 'SENT']);
        res.json({
            success: true,
            message: isDraft ? 'Draf email berhasil disimpan!' : `Email berhasil dikirim ke ${recipientEmail}!`,
            id: result.insertId
        });
    }
    catch (err) {
        res.status(500).json({ error: `Gagal memproses email: ${err.message}` });
    }
};
exports.createOrSendEmailMessage = createOrSendEmailMessage;
/**
 * PUT /api/admin/emails/messages/:id/folder
 */
const updateMessageFolder = async (req, res) => {
    const { id } = req.params;
    const { folder } = req.body;
    try {
        await db_1.default.query('UPDATE email_messages SET folder = ? WHERE id = ?', [folder, id]);
        res.json({ message: `Email dipindahkan ke ${folder}` });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Gagal memperbarui folder email' });
    }
};
exports.updateMessageFolder = updateMessageFolder;
/**
 * DELETE /api/admin/emails/messages/:id
 */
const deleteEmailMessage = async (req, res) => {
    const { id } = req.params;
    try {
        await db_1.default.query('DELETE FROM email_messages WHERE id = ?', [id]);
        res.json({ message: 'Email berhasil dihapus secara permanen' });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Gagal menghapus email' });
    }
};
exports.deleteEmailMessage = deleteEmailMessage;
/**
 * POST /api/admin/emails/sync-roundcube
 * Sync real live emails from Roundcube IMAP Server (mail.erwinsyahrudin.online:993)
 */
const syncRoundcubeEmails = async (req, res) => {
    try {
        await (0, exports.ensureEmailTables)();
        const host = process.env.IMAP_HOST || process.env.SMTP_HOST || 'mail.erwinsyahrudin.online';
        const port = Number(process.env.IMAP_PORT) || 993;
        const user = process.env.IMAP_USER || process.env.SMTP_USER || 'support@erwinsyahrudin.online';
        const password = process.env.IMAP_PASS || process.env.SMTP_PASS || 'Erwinsyah!@8';
        if (!user || !password) {
            const errRes = { error: 'Kredensial IMAP / SMTP belum dikonfigurasi' };
            if (res)
                return res.status(400).json(errRes);
            return errRes;
        }
        const config = {
            imap: {
                user,
                password,
                host,
                port,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
                authTimeout: 10000
            }
        };
        const connection = await imap_simple_1.default.connect(config);
        await connection.openBox('INBOX');
        const searchCriteria = ['ALL'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], struct: true };
        const messages = await connection.search(searchCriteria, fetchOptions);
        let syncedCount = 0;
        for (const item of messages) {
            const allParts = item.parts.find(p => p.which === '');
            const bodyData = allParts ? allParts.body : '';
            if (bodyData) {
                const parsed = await (0, mailparser_1.simpleParser)(bodyData);
                const senderEmail = parsed.from?.value[0]?.address || 'unknown@domain.com';
                const senderName = parsed.from?.value[0]?.name || parsed.from?.text || senderEmail;
                const recipientEmail = parsed.to ? (Array.isArray(parsed.to) ? parsed.to[0]?.value[0]?.address : parsed.to.value[0]?.address) || user : user;
                const subject = parsed.subject || '(Tanpa Subjek)';
                const bodyHtml = parsed.html || `<p>${(parsed.text || '').replace(/\n/g, '<br/>')}</p>`;
                const dateCreated = parsed.date ? new Date(parsed.date) : new Date();
                // Check if message already synced (by sender_email, subject, created_at)
                const [existing] = await db_1.default.query('SELECT id FROM email_messages WHERE sender_email = ? AND subject = ? AND folder = "INBOX"', [senderEmail, subject]);
                if (existing.length === 0) {
                    await db_1.default.query('INSERT INTO email_messages (sender_email, sender_name, recipient_email, recipient_name, subject, body_html, body_text, folder, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, "INBOX", "UNREAD", ?)', [senderEmail, senderName, recipientEmail, user, subject, bodyHtml, parsed.text || '', dateCreated]);
                    syncedCount++;
                }
            }
        }
        connection.end();
        const responseData = {
            success: true,
            message: `Sinkronisasi Roundcube IMAP Berhasil! ${syncedCount} email baru diimpor dari mailbox support@erwinsyahrudin.online.`,
            totalInServer: messages.length,
            syncedCount
        };
        if (res)
            return res.json(responseData);
        return responseData;
    }
    catch (err) {
        console.error('[IMAP Sync Error]', err.message);
        const errRes = { error: `Gagal sinkronisasi IMAP Roundcube: ${err.message}` };
        if (res)
            return res.status(500).json(errRes);
        return errRes;
    }
};
exports.syncRoundcubeEmails = syncRoundcubeEmails;
