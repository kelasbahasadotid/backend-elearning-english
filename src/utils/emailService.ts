import nodemailer from 'nodemailer';

export interface SendWelcomeEmailParams {
  toEmail: string;
  customerName: string;
  password?: string;
  packageName: string;
  accessDays: number;
  expiredAt?: string;
  loginUrl?: string;
  isNewAccount?: boolean;
}

/**
 * Send automated welcome email to student after Scalev transaction (Light Theme)
 */
export const sendScalevWelcomeEmail = async (params: SendWelcomeEmailParams) => {
  const {
    toEmail,
    customerName,
    password = 'passwordlms123',
    packageName,
    accessDays,
    expiredAt,
    loginUrl = process.env.APP_URL || 'https://unenvied-problem-conch.ngrok-free.dev/login',
    isNewAccount = true
  } = params;

  const host = process.env.SMTP_HOST || 'mail.erwinsyahrudin.online';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || 'support@erwinsyahrudin.online';
  const pass = process.env.SMTP_PASS || '';
  const fromName = process.env.SMTP_FROM_NAME || 'E-Learning English Support';
  const fromEmail = process.env.SMTP_FROM || user || 'support@erwinsyahrudin.online';

  console.log(`[Email Service] Preparing Light Theme welcome email for ${customerName} (${toEmail}) - Package: "${packageName}"`);

  // Build Transporter
  let transporter: nodemailer.Transporter;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
  } else {
    // If SMTP credentials not provided in .env, use jsonTransport for safe logging without crashing
    transporter = nodemailer.createTransport({
      jsonTransport: true
    } as any);
  }

  const formattedExpiry = expiredAt ? new Date(expiredAt).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : `${accessDays} Hari dari sekarang`;

  const defaultDisplayPassword = password || 'passwordlms123';

  // Crisp Light Mode Email Template
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Akses E-Learning Aktif</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F1F5F9; color: #1E293B; margin: 0; padding: 25px 15px; }
        .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1E293B, #0F172A); padding: 32px 24px; text-align: center; }
        .header h1 { color: #EAB308; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
        .header p { color: #94A3B8; margin: 6px 0 0 0; font-size: 13px; font-weight: 500; }
        .content { padding: 32px 28px; line-height: 1.6; color: #334155; }
        .greeting { font-size: 16px; color: #0F172A; margin-bottom: 12px; }
        .card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 20px; margin: 20px 0; }
        .badge-pkg { background: #FEF08A; color: #854D0E; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; display: inline-block; border: 1px solid #FDE047; text-transform: uppercase; }
        .badge-cred { background: #E0F2FE; color: #0369A1; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; display: inline-block; border: 1px solid #BAE6FD; text-transform: uppercase; }
        .pkg-title { color: #0F172A; margin: 10px 0 6px 0; font-size: 17px; font-weight: 800; }
        .cred-table { width: 100%; margin-top: 12px; border-collapse: collapse; font-size: 14px; }
        .cred-table td { padding: 6px 0; }
        .cred-label { color: #64748B; width: 120px; font-weight: 600; }
        .cred-val { color: #0F172A; font-weight: 800; font-family: 'Courier New', Courier, monospace; font-size: 15px; }
        .btn-container { text-align: center; margin-top: 30px; margin-bottom: 10px; }
        .btn { display: inline-block; background: #EAB308; color: #000000; text-decoration: none; padding: 15px 32px; border-radius: 14px; font-weight: 900; font-size: 14px; box-shadow: 0 4px 14px rgba(234, 179, 8, 0.4); transition: all 0.2s ease; }
        .footer { text-align: center; padding: 24px; color: #94A3B8; font-size: 12px; background: #F8FAFC; border-t: 1px solid #E2E8F0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 E-Learning Bahasa Inggris</h1>
          <p>Selamat datang di Platform Pembelajaran Online!</p>
        </div>
        <div class="content">
          <div class="greeting">Halo <b>${customerName}</b>,</div>
          <p style="margin: 0; font-size: 14px;">Pembelian paket e-learning Anda telah <span style="color: #16A34A; font-weight: 800;">BERHASIL DIPROSES</span>! Akun siswa Anda sudah aktif dan kelas siap dipelajari.</p>
          
          <div class="card">
            <span class="badge-pkg">📦 Rincian Paket Pembelian</span>
            <div class="pkg-title">${packageName}</div>
            <p style="margin: 0; color: #475569; font-size: 13px;">🕒 Masa Aktif Akses: <b style="color: #0F172A;">${accessDays} Hari</b> (s.d. ${formattedExpiry})</p>
          </div>

          <div class="card">
            <span class="badge-cred">🔑 Kredensial Akun Login Anda</span>
            <table class="cred-table">
              <tr>
                <td class="cred-label">Email Login:</td>
                <td class="cred-val">${toEmail}</td>
              </tr>
              <tr>
                <td class="cred-label">Password:</td>
                <td class="cred-val" style="color: #D97706;">${defaultDisplayPassword}</td>
              </tr>
            </table>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748B; italic;">
              💡 <i>Gunakan email dan password di atas untuk masuk ke platform pembelajaran. Anda dapat mengubah password kapan saja di menu profil setelah login.</i>
            </p>
          </div>

          <div class="btn-container">
            <a href="${loginUrl}" class="btn">🚀 BUKA KELAS & MULAI BELAJAR</a>
          </div>
        </div>
        <div class="footer">
          <p style="margin: 0;">Email ini dikirimkan secara otomatis dari sistem pendaftaran E-Learning Scalev.<br/>Jika Anda membutuhkan bantuan, silakan hubungi tim support kami.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject: `🎉 Akses Kelas Aktif: ${packageName} - ${customerName}`,
      html: htmlContent
    });

    console.log(`[Email Service] Light Theme welcome email successfully sent to ${toEmail}. MessageId: ${info.messageId || 'Logged'}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[Email Service] Failed to send welcome email to ${toEmail}:`, err.message);
    return { success: false, error: err.message };
  }
};
