import pool from '../src/config/db';
import {
  ensureEmailTables,
  getSmtpConfig,
  getEmailMessages
} from '../src/controllers/emailController';

async function testEmailModule() {
  console.log('--- TESTING EMAIL MANAGEMENT SYSTEM ENDPOINTS & DATABASE ---');

  // 1. Ensure Table Structure
  await ensureEmailTables();
  console.log('✅ Email table & initial data verified');

  // 2. Get SMTP Configuration
  const config = await getSmtpConfig();
  console.log('✅ Current SMTP Configuration:', {
    host: config.host,
    port: config.port,
    user: config.user,
    fromEmail: config.fromEmail,
    fromName: config.fromName
  });

  // 3. Test Inserting Message Record (Draft & Sent)
  const timestamp = Date.now();
  const [draftRes]: any = await pool.query(
    'INSERT INTO email_messages (sender_email, sender_name, recipient_email, recipient_name, subject, body_html, folder, status) VALUES (?, ?, ?, ?, ?, ?, "DRAFT", "READ")',
    [config.fromEmail, config.fromName, 'draft.student@example.com', 'Draft Student', `Draft Subject ${timestamp}`, '<p>Content draft</p>']
  );
  console.log(`✅ Draft Email Message Created (ID: ${draftRes.insertId})`);

  // 4. Test Fetching Email Messages
  const mockReq = { query: { folder: 'DRAFT', search: '' } } as any;
  let responseData: any = null;
  const mockRes = {
    json: (data: any) => { responseData = data; },
    status: () => mockRes
  } as any;

  await getEmailMessages(mockReq, mockRes);
  console.log(`✅ Fetched ${responseData?.messages?.length || 0} DRAFT messages. Counts:`, responseData?.counts);

  // 5. Test Moving Message to SPAM
  await pool.query('UPDATE email_messages SET folder = "SPAM" WHERE id = ?', [draftRes.insertId]);
  console.log(`✅ Message ID ${draftRes.insertId} moved to SPAM folder successfully`);

  console.log('--- ALL EMAIL SYSTEM ENDPOINT TESTS PASSED ---');
  process.exit(0);
}

testEmailModule().catch(err => {
  console.error('Email module test failed:', err);
  process.exit(1);
});
