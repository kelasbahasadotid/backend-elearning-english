import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

async function testImapConnection() {
  console.log('--- CONNECTING TO ROUNDCUBE IMAP MAILBOX (mail.erwinsyahrudin.online:993) ---');

  const config = {
    imap: {
      user: process.env.IMAP_USER || process.env.SMTP_USER || 'support@erwinsyahrudin.online',
      password: process.env.IMAP_PASS || process.env.SMTP_PASS || 'Erwinsyah!@8',
      host: process.env.IMAP_HOST || process.env.SMTP_HOST || 'mail.erwinsyahrudin.online',
      port: Number(process.env.IMAP_PORT) || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000
    }
  };

  console.log(`Connecting to IMAP ${config.imap.host}:${config.imap.port} for ${config.imap.user}...`);

  try {
    const connection = await imaps.connect(config);
    console.log('✅ IMAP Connection Successful!');

    await connection.openBox('INBOX');
    console.log('✅ INBOX Box Opened!');

    const searchCriteria = ['UNSEEN', 'ALL'];
    const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], struct: true };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`✅ Found ${messages.length} messages in Roundcube INBOX!`);

    for (let i = 0; i < Math.min(messages.length, 5); i++) {
      const item = messages[i];
      const allParts = item.parts.find(p => p.which === '');
      const bodyData = allParts ? allParts.body : '';

      if (bodyData) {
        const parsed = await simpleParser(bodyData);
        console.log(`\n📬 [Message ${i + 1}]`);
        console.log(`   Subject: ${parsed.subject}`);
        console.log(`   From: ${parsed.from?.text}`);
        console.log(`   Date: ${parsed.date}`);
        console.log(`   Snippet: ${(parsed.text || '').slice(0, 100).replace(/\n/g, ' ')}...`);
      }
    }

    connection.end();
    console.log('\n--- IMAP CONNECTION TEST COMPLETE ---');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ IMAP Connection Error:', err);
    process.exit(1);
  }
}

testImapConnection();
