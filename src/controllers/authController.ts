import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const sendVerificationEmail = async (email: string, fullName: string, code: string) => {
  const smtpHost = process.env.SMTP_HOST || 'mail.erwinsyahrudin.online';
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const smtpUser = process.env.SMTP_USER || 'support@erwinsyahrudin.online';
  const smtpPass = process.env.SMTP_PASS || 'Erwinsyah!@8';

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false }
  });

  const fromEmail = process.env.SMTP_FROM || smtpUser;

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kode Verifikasi Pendaftaran Akun GlobalEnglish</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: Arial, Helvetica, sans-serif; color: #f8fafc;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0f172a; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <tr>
            <td style="background-color: #0284c7; background-image: linear-gradient(to right, #0284c7, #38bdf8); padding: 28px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; tracking-wide: 1px;">GlobalEnglish LMS</h1>
              <p style="color: #e0f2fe; margin: 4px 0 0 0; font-size: 13px;">Platform Pembelajaran Bahasa Inggris Interaktif</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="font-size: 20px; color: #f8fafc; margin-top: 0; margin-bottom: 12px; font-weight: 800;">Kode Verifikasi Pendaftaran Akun</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px;">
                Halo <b>${fullName || 'Pengguna'}</b>,<br>
                Terima kasih telah mendaftar di GlobalEnglish. Masukkan 6-digit kode verifikasi berikut untuk mengaktifkan akun Anda:
              </p>
              
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #0f172a; border: 2px dashed #eab308; padding: 18px 36px; border-radius: 12px; text-align: center;">
                      <span style="font-size: 32px; font-weight: 900; letter-spacing: 10px; color: #facc15; font-family: 'Courier New', Courier, monospace;">${code}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: 10px; margin-bottom: 24px;">
                ⚠️ Kode verifikasi ini berlaku selama <b>15 menit</b>. Jangan berikan kode ini kepada siapapun.
              </p>

              <div style="border-top: 1px solid #334155; padding-top: 20px; text-align: center;">
                <p style="font-size: 12px; color: #64748b; margin: 0;">
                  Jika Anda tidak merasa mendaftar di GlobalEnglish LMS, abaikan email ini.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"GlobalEnglish LMS" <${fromEmail}>`,
    sender: fromEmail,
    to: email,
    replyTo: fromEmail,
    subject: `[${code}] Kode Verifikasi Pendaftaran Akun GlobalEnglish`,
    text: `Halo ${fullName},\n\nKode verifikasi akun GlobalEnglish Anda adalah: ${code}\n\nKode ini berlaku selama 15 menit.\n\nTerima kasih,\nTim GlobalEnglish LMS`,
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High',
      'Importance': 'High',
      'X-Mailer': 'GlobalEnglish Verification System',
      'Auto-Submitted': 'auto-generated'
    },
    html: htmlContent
  });
};

export const register = async (req: AuthRequest, res: Response) => {
  const { fullName, email, username, password } = req.body;

  if (!fullName || !email || !username || !password) {
     res.status(400).json({ error: 'Semua kolom wajib diisi' });
     return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Ensure verification columns exist on users table
    try {
      await connection.query('ALTER TABLE users ADD COLUMN verification_code VARCHAR(10) DEFAULT NULL');
    } catch {}
    try {
      await connection.query('ALTER TABLE users ADD COLUMN verification_expires DATETIME DEFAULT NULL');
    } catch {}

    // Check if email or username already exists
    const [existing] = await connection.query<RowDataPacket[]>(
      'SELECT id, status FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (existing.length > 0) {
       const userExist = existing[0];
       if (userExist.status === 'ACTIVE') {
         res.status(409).json({ error: 'Email atau username sudah terdaftar dan aktif' });
         connection.release();
         return;
       }
       // If PENDING, update password and verification code and resend email
       await connection.query(
         `UPDATE users SET full_name = ?, password = ?, verification_code = ?, verification_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?`,
         [fullName, hashedPassword, verificationCode, userExist.id]
       );

       await connection.commit();

       try {
         await sendVerificationEmail(email, fullName, verificationCode);
       } catch (mErr) {
         console.error('Email send error:', mErr);
       }

       res.status(200).json({
         message: 'Kode verifikasi telah dikirimkan ke email Anda',
         requireVerification: true,
         email
       });
       connection.release();
       return;
    }

    // Insert user with status PENDING
    const [userResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO users (role_id, full_name, email, username, password, status, verification_code, verification_expires) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
      [4, fullName, email, username, hashedPassword, 'PENDING', verificationCode]
    );

    const userId = userResult.insertId;

    // Create user profile
    await connection.query(
      'INSERT INTO user_profiles (user_id) VALUES (?)',
      [userId]
    );

    await connection.commit();

    try {
      await sendVerificationEmail(email, fullName, verificationCode);
    } catch (mErr) {
      console.error('Email send error:', mErr);
    }

    res.status(201).json({
      message: 'Kode verifikasi telah dikirimkan ke email Anda',
      requireVerification: true,
      email
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message || 'Gagal mendaftar akun' });
  } finally {
    connection.release();
  }
};

export const verifyCode = async (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    res.status(400).json({ error: 'Email dan Kode Verifikasi wajib diisi' });
    return;
  }

  try {
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, role_id, full_name, email, username, status, verification_code, verification_expires FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      res.status(404).json({ error: 'Akun tidak ditemukan' });
      return;
    }

    const user = users[0];

    if (user.status === 'ACTIVE') {
      const token = jwt.sign(
        { id: user.id, roleId: user.role_id, email: user.email, username: user.username },
        process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key',
        { expiresIn: '24h' }
      );
      res.json({
        message: 'Akun Anda sudah terverifikasi!',
        token,
        user: { id: user.id, roleId: user.role_id, fullName: user.full_name, email: user.email, username: user.username, xp: 0, level: 1 }
      });
      return;
    }

    if (user.verification_code !== String(code).trim()) {
      res.status(400).json({ error: 'Kode verifikasi yang Anda masukkan tidak sesuai' });
      return;
    }

    // Activate user
    await pool.query(
      'UPDATE users SET status = "ACTIVE", verification_code = NULL, verification_expires = NULL WHERE id = ?',
      [user.id]
    );

    // Initialize user_statistics
    await pool.query(
      'INSERT INTO user_statistics (user_id, xp, level) VALUES (?, 0, 1) ON DUPLICATE KEY UPDATE user_id = user_id',
      [user.id]
    );

    const token = jwt.sign(
      { id: user.id, roleId: user.role_id, email: user.email, username: user.username },
      process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Verifikasi akun berhasil!',
      token,
      user: {
        id: user.id,
        roleId: user.role_id,
        fullName: user.full_name,
        email: user.email,
        username: user.username,
        xp: 0,
        level: 1
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memverifikasi kode' });
  }
};

export const resendCode = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email wajib diisi' });
    return;
  }

  try {
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, full_name, email, status FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      res.status(404).json({ error: 'Akun tidak ditemukan' });
      return;
    }

    const user = users[0];
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    await pool.query(
      'UPDATE users SET verification_code = ?, verification_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
      [newCode, user.id]
    );

    await sendVerificationEmail(user.email, user.full_name, newCode);

    res.json({ message: 'Kode verifikasi baru telah dikirimkan ke email Anda' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengirim ulang kode verifikasi' });
  }
};

export const login = async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
     res.status(400).json({ error: 'Email and password are required' });
     return;
  }

  try {
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, role_id, full_name, email, username, password, status FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
       res.status(401).json({ error: 'Invalid email or password' });
       return;
    }

    const user = users[0];

    if (user.status !== 'ACTIVE') {
       res.status(403).json({ error: `Account is ${user.status.toLowerCase()}` });
       return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
       res.status(401).json({ error: 'Invalid email or password' });
       return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, roleId: user.role_id, email: user.email, username: user.username },
      process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key',
      { expiresIn: '24h' }
    );

    // Fetch user statistics (XP and level)
    const [statsRows] = await pool.query<RowDataPacket[]>(
      'SELECT xp, level FROM user_statistics WHERE user_id = ?',
      [user.id]
    );
    let xp = Number(statsRows[0]?.xp || 0);
    let level = Number(statsRows[0]?.level || 1);

    if (xp === 0) {
      const [txRows] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(SUM(xp), 0) as total_xp FROM xp_transactions WHERE user_id = ?',
        [user.id]
      );
      const totalTxXp = Number(txRows[0]?.total_xp || 0);
      if (totalTxXp > 0) {
        xp = totalTxXp;
        level = Math.floor(xp / 200) + 1;
        await pool.query(
          'INSERT INTO user_statistics (user_id, xp, level) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE xp = ?, level = ?',
          [user.id, xp, level, xp, level]
        );
      }
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        roleId: user.role_id,
        fullName: user.full_name,
        email: user.email,
        username: user.username,
        xp,
        level
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  try {
    const [profileData] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.full_name, u.email, u.username, u.avatar, u.phone, 
              p.gender, p.birth_date, p.country, p.province, p.city, p.address, p.postal_code, p.bio, p.profession, p.education, p.organization 
       FROM users u 
       LEFT JOIN user_profiles p ON u.id = p.user_id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (profileData.length === 0) {
       res.status(404).json({ error: 'Profile not found' });
       return;
    }

    // Fetch & calculate user statistics (derive from official XP transactions and user stats)
    const [txRows] = await pool.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(xp), 0) as total_tx_xp FROM xp_transactions WHERE user_id = ?',
      [req.user.id]
    );
    const totalTxXp = Number(txRows[0]?.total_tx_xp || 0);

    const [statsRows] = await pool.query<RowDataPacket[]>(
      'SELECT xp, level FROM user_statistics WHERE user_id = ?',
      [req.user.id]
    );
    const dbStatsXp = Number(statsRows[0]?.xp || 0);

    // Total XP is derived strictly from official transactions or recorded user_statistics
    const xp = Math.max(dbStatsXp, totalTxXp);
    const level = Math.max(1, Math.floor(xp / 200) + 1);

    // Upsert into user_statistics to keep database synchronized
    await pool.query(
      `INSERT INTO user_statistics (user_id, xp, level) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE xp = ?, level = ?`,
      [req.user.id, xp, level, xp, level]
    );

    // Fetch real enrollments with progress
    const [enrollmentRows] = await pool.query<RowDataPacket[]>(
      `SELECT e.id, e.course_id, c.title as course_title, c.slug as course_slug, COALESCE(MAX(cp.overall_progress), 0) as progress_percent
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN course_progress cp ON (e.id = cp.enrollment_id OR (e.user_id = cp.user_id AND e.course_id = cp.course_id))
       WHERE e.user_id = ? AND LOWER(e.status) = 'active'
       GROUP BY e.id, e.course_id, c.title, c.slug`,
      [req.user.id]
    );

    res.json({
      ...profileData[0],
      xp,
      level,
      enrollments: enrollmentRows
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

import nodemailer from 'nodemailer';

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email wajib diisi' });
    return;
  }

  try {
    // 1. Find user by email
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, full_name, email, username FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      res.status(404).json({ error: 'Tidak ada akun terdaftar dengan alamat email ini' });
      return;
    }

    const targetUser = users[0];
    const newPasswordPlain = 'barupassword123';
    const newPasswordHash = await bcrypt.hash(newPasswordPlain, 10);

    // 2. Reset user's password in database to barupassword123
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [newPasswordHash, targetUser.id]
    );

    // 3. Configure Nodemailer Transporter using SMTP settings
    const smtpHost = process.env.SMTP_HOST || 'mail.erwinsyahrudin.online';
    const smtpPort = Number(process.env.SMTP_PORT) || 465;
    const smtpUser = process.env.SMTP_USER || 'support@erwinsyahrudin.online';
    const smtpPass = process.env.SMTP_PASS || 'Erwinsyah!@8';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for 587/25
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const fromName = process.env.SMTP_FROM_NAME || 'GlobalEnglish Support';
    const fromEmail = process.env.SMTP_FROM || smtpUser;

    const resetRef = Math.floor(100000 + Math.random() * 900000).toString();

    const mailOptions = {
      from: `"GlobalEnglish LMS" <${fromEmail}>`,
      sender: fromEmail,
      to: targetUser.email,
      replyTo: fromEmail,
      subject: `[PWD-${resetRef}] Informasi Reset Kata Sandi Akun GlobalEnglish`,
      text: `Halo ${targetUser.full_name || targetUser.username},\n\nPassword akun Anda untuk email ${targetUser.email} telah di-reset.\n\nPassword Baru Anda: ${newPasswordPlain}\n\nSilakan login ke aplikasi menggunakan password baru ini dan segera ubah password Anda di menu Pengaturan Profil setelah login.\n\nTerima kasih,\nTim Support GlobalEnglish LMS`,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High',
        'X-Mailer': 'GlobalEnglish Security System',
        'Auto-Submitted': 'auto-generated'
      },
      html: `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Kata Sandi Akun GlobalEnglish</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: Arial, Helvetica, sans-serif; color: #f8fafc;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0f172a; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0284c7; background-image: linear-gradient(to right, #0284c7, #38bdf8); padding: 28px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; tracking-wide: 1px;">GlobalEnglish LMS</h1>
              <p style="color: #e0f2fe; margin: 4px 0 0 0; font-size: 13px;">Sistem Keamanan Layanan Pengguna</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="font-size: 20px; color: #f8fafc; margin-top: 0; margin-bottom: 12px; font-weight: 800;">Informasi Reset Kata Sandi</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px;">
                Halo <b>${targetUser.full_name || targetUser.username}</b>,<br>
                Kami telah memproses pembaruan kata sandi untuk akun email <b>${targetUser.email}</b>. Kata sandi akun Anda saat ini telah diperbarui menjadi:
              </p>
              
              <!-- Password Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #0f172a; border: 2px dashed #eab308; padding: 18px 32px; border-radius: 12px; text-align: center;">
                      <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; display: block; margin-bottom: 6px;">KATA SANDI BARU</span>
                      <span style="font-size: 26px; font-weight: 900; color: #facc15; font-family: 'Courier New', Courier, monospace; letter-spacing: 2px;">${newPasswordPlain}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1; margin-top: 20px; margin-bottom: 24px;">
                Silakan masuk menggunakan kata sandi baru di atas. Demi keamanan akun Anda, disarankan untuk memperbarui kata sandi ini pada menu <b>Pengaturan Profil</b> setelah berhasil masuk.
              </p>

              <div style="border-top: 1px solid #334155; padding-top: 20px; text-align: center;">
                <p style="font-size: 12px; color: #64748b; margin: 0;">
                  Email ini dikirim secara otomatis oleh Sistem Layanan Pelanggan GlobalEnglish LMS.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Reset password email sent successfully to ${targetUser.email}`);
    } catch (mailErr: any) {
      console.error('SMTP Email sending error:', mailErr);
    }

    res.json({
      message: `Password akun Anda telah berhasil di-reset menjadi: ${newPasswordPlain}. Email pemberitahuan telah dikirimkan ke ${targetUser.email}.`
    });
  } catch (error: any) {
    console.error('Failed to reset password:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userId = req.user.id;
  const {
    fullName,
    username,
    email,
    phone,
    avatar,
    oldPassword,
    newPassword,
    gender,
    birthDate,
    country,
    province,
    city,
    address,
    postalCode,
    bio,
    profession,
    education,
    organization
  } = req.body;

  try {
    // 1. Fetch existing user
    const [users] = await pool.query<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const currentUser = users[0];

    // 2. Validate & Update Password if requested
    let passwordHash = currentUser.password;
    if (newPassword) {
      if (!oldPassword) {
        res.status(400).json({ error: 'Password lama wajib diisi untuk mengganti password baru' });
        return;
      }
      const isMatch = await bcrypt.compare(oldPassword, currentUser.password);
      if (!isMatch) {
        res.status(400).json({ error: 'Password lama yang Anda masukkan salah' });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        return;
      }
      passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // 3. Check username / email uniqueness if changed
    if (username && username !== currentUser.username) {
      const [existingUser] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (existingUser.length > 0) {
        res.status(400).json({ error: 'Username sudah digunakan oleh pengguna lain' });
        return;
      }
    }
    if (email && email !== currentUser.email) {
      const [existingEmail] = await pool.query<RowDataPacket[]>('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existingEmail.length > 0) {
        res.status(400).json({ error: 'Email sudah terdaftar untuk akun lain' });
        return;
      }
    }

    // 4. Update users table
    await pool.query(
      `UPDATE users 
       SET full_name = ?, username = ?, email = ?, phone = ?, avatar = ?, password = ?
       WHERE id = ?`,
      [
        fullName || currentUser.full_name,
        username || currentUser.username,
        email || currentUser.email,
        phone !== undefined ? phone : currentUser.phone,
        avatar !== undefined ? avatar : currentUser.avatar,
        passwordHash,
        userId
      ]
    );

    // 5. Update user_profiles table (upsert profile)
    await pool.query(
      `INSERT INTO user_profiles (user_id, gender, birth_date, country, province, city, address, postal_code, bio, profession, education, organization)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       gender = VALUES(gender),
       birth_date = VALUES(birth_date),
       country = VALUES(country),
       province = VALUES(province),
       city = VALUES(city),
       address = VALUES(address),
       postal_code = VALUES(postal_code),
       bio = VALUES(bio),
       profession = VALUES(profession),
       education = VALUES(education),
       organization = VALUES(organization)`,
      [
        userId,
        gender || null,
        birthDate || null,
        country || null,
        province || null,
        city || null,
        address || null,
        postalCode || null,
        bio || null,
        profession || null,
        education || null,
        organization || null
      ]
    );

    // 6. Fetch updated profile data
    const [updatedData] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.role_id, u.full_name, u.email, u.username, u.avatar, u.phone,
              p.gender, p.birth_date, p.country, p.province, p.city, p.address, p.postal_code, p.bio, p.profession, p.education, p.organization
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [userId]
    );

    const [statsRows] = await pool.query<RowDataPacket[]>('SELECT xp, level FROM user_statistics WHERE user_id = ?', [userId]);

    res.json({
      message: 'Profil berhasil diperbarui!',
      user: {
        id: updatedData[0].id,
        roleId: updatedData[0].role_id,
        fullName: updatedData[0].full_name,
        email: updatedData[0].email,
        username: updatedData[0].username,
        phone: updatedData[0].phone,
        avatar: updatedData[0].avatar,
        xp: Number(statsRows[0]?.xp || 0),
        level: Number(statsRows[0]?.level || 1),
        profile: updatedData[0]
      }
    });
  } catch (error: any) {
    console.error('Failed to update profile', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

/**
 * POST /api/auth/social-login
 * Body: { provider: 'google' | 'facebook', email: string, fullName: string, photoURL?: string, uid: string }
 */
export const socialLogin = async (req: Request, res: Response) => {
  const { provider, email, fullName, photoURL, uid } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email dari akun sosial tidak ditemukan' });
    return;
  }

  try {
    // Check if user exists by email
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.role_id, u.full_name, u.email, u.username, u.avatar, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ? LIMIT 1`,
      [email]
    );

    let isNewUser = false;
    let userObj: any = null;

    if (existing.length > 0) {
      userObj = existing[0];
      isNewUser = false;
    } else {
      isNewUser = true;
      // Auto-register new student (role_id = 4)
      const baseUsername = (fullName || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || `user${Date.now().toString().slice(-4)}`;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const uniqueUsername = `${baseUsername}${randomSuffix}`;

      // Generate dummy hashed password for social login users
      const dummyPass = await bcrypt.hash(`social_${provider}_${uid}_${Date.now()}`, 10);

      const [insertResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO users (role_id, full_name, email, username, password, avatar, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [4, fullName || 'Siswa Social', email, uniqueUsername, dummyPass, photoURL || null]
      );

      const newUserId = insertResult.insertId;

      // Seed statistics for student
      await pool.query('INSERT IGNORE INTO user_statistics (user_id, xp, level) VALUES (?, 0, 1)', [newUserId]);

      userObj = {
        id: newUserId,
        role_id: 4,
        full_name: fullName || 'Siswa Social',
        email,
        username: uniqueUsername,
        avatar: photoURL || null,
        role_name: 'Student'
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: userObj.id, role_id: userObj.role_id, email: userObj.email },
      process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key',
      { expiresIn: '7d' }
    );

    // Fetch statistics
    const [stats] = await pool.query<RowDataPacket[]>(
      'SELECT xp, level FROM user_statistics WHERE user_id = ?',
      [userObj.id]
    );

    res.json({
      message: `Berhasil masuk dengan ${provider === 'google' ? 'Google' : 'Facebook'}!`,
      token,
      isNewUser,
      user: {
        id: userObj.id,
        roleId: userObj.role_id,
        roleName: userObj.role_name || 'Student',
        fullName: userObj.full_name,
        email: userObj.email,
        username: userObj.username,
        avatar: userObj.avatar,
        xp: Number(stats[0]?.xp || 0),
        level: Number(stats[0]?.level || 1)
      }
    });
  } catch (error: any) {
    console.error('Social login error:', error);
    res.status(500).json({ error: error.message || 'Gagal melakukan login sosial' });
  }
};

/**
 * POST /api/auth/complete-onboarding
 * Body: { fullName: string, username: string, phone?: string, password?: string }
 */
export const completeOnboarding = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { fullName, username, phone, password } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    let updateFields: string[] = [];
    let queryParams: any[] = [];

    if (fullName) {
      updateFields.push('full_name = ?');
      queryParams.push(fullName);
    }

    if (username) {
      const [userCheck] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
        [username, userId]
      );
      if (userCheck.length > 0) {
        res.status(400).json({ error: 'Username sudah digunakan oleh pengguna lain' });
        return;
      }
      updateFields.push('username = ?');
      queryParams.push(username);
    }

    if (phone !== undefined) {
      updateFields.push('phone = ?');
      queryParams.push(phone);
    }

    if (password && password.trim().length >= 6) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      queryParams.push(hashedPassword);
    }

    if (updateFields.length > 0) {
      queryParams.push(userId);
      await pool.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, queryParams);
    }

    // Fetch updated user
    const [updatedRows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.role_id, u.full_name, u.email, u.username, u.avatar, u.phone, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [userId]
    );

    const [stats] = await pool.query<RowDataPacket[]>(
      'SELECT xp, level FROM user_statistics WHERE user_id = ?',
      [userId]
    );

    const userObj = updatedRows[0];

    res.json({
      message: 'Profil & password berhasil disimpan!',
      user: {
        id: userObj.id,
        roleId: userObj.role_id,
        roleName: userObj.role_name || 'Student',
        fullName: userObj.full_name,
        email: userObj.email,
        username: userObj.username,
        avatar: userObj.avatar,
        phone: userObj.phone,
        xp: Number(stats[0]?.xp || 0),
        level: Number(stats[0]?.level || 1)
      }
    });
  } catch (error: any) {
    console.error('Onboarding update error:', error);
    res.status(500).json({ error: error.message || 'Gagal menyimpan profil & password' });
  }
};
