import pool from '../src/config/db';
import fs from 'fs';
import path from 'path';

async function testAllAudioGeneration() {
  const { Communicate } = require('edge-tts-universal');
  console.log('\n=== TESTING AUDIO SYNTHESIS & SAVE ===\n');

  // Test 1: Single Audio Generation
  try {
    console.log('1. Testing Single AI Audio (en-US-EmmaNeural)...');
    const text = 'Welcome to our English class. Let us practice speaking today!';
    const voice = 'en-US-EmmaNeural';
    const comm = new Communicate(text, { voice });
    const chunks: Buffer[] = [];
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio') chunks.push(chunk.data);
    }
    const buf = Buffer.concat(chunks);
    console.log(`   -> Single audio generated: ${buf.length} bytes`);
    if (buf.length === 0) throw new Error('Single buffer is empty!');

    const mediaDir = path.join(process.cwd(), 'uploads', 'media');
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

    const filename = `test-single-${Date.now()}.mp3`;
    const fullPath = path.join(mediaDir, filename);
    fs.writeFileSync(fullPath, buf);
    console.log(`   -> File written to disk: ${fullPath} (${fs.statSync(fullPath).size} bytes)`);

    const [res]: any = await pool.query(
      `INSERT INTO media_files (title, filename, file_url, file_type, mime_type, file_size, duration_seconds, source_type, ai_prompt_text, ai_voice_code, ai_speed, created_by)
       VALUES (?, ?, ?, 'AUDIO', 'audio/mpeg', ?, 4, 'AI_TTS', ?, ?, 1.00, 1)`,
      ['Test Single Emma', filename, `/uploads/media/${filename}`, buf.length, text, voice]
    );
    console.log(`   -> Inserted to DB ID: ${res.insertId}`);
  } catch (e: any) {
    console.error('   ❌ Single audio test failed:', e.message);
  }

  // Test 2: Dialogue Audio Generation
  try {
    console.log('\n2. Testing Multi-Speaker Dialogue Generation...');
    const lines = [
      { speaker: 'Emma', voice: 'en-US-EmmaNeural', text: 'Hello Ryan! How is your project going?' },
      { speaker: 'James', voice: 'en-GB-RyanNeural', text: 'Hi Emma! It is going great, thank you.' }
    ];

    const audioSegments: Buffer[] = [];
    for (const line of lines) {
      const comm = new Communicate(line.text, { voice: line.voice });
      const chunks: Buffer[] = [];
      for await (const chunk of comm.stream()) {
        if (chunk.type === 'audio') chunks.push(chunk.data);
      }
      if (chunks.length > 0) audioSegments.push(Buffer.concat(chunks));
    }
    const combined = Buffer.concat(audioSegments);
    console.log(`   -> Combined dialogue generated: ${combined.length} bytes (from ${lines.length} lines)`);
    if (combined.length === 0) throw new Error('Dialogue buffer is empty!');

    const mediaDir = path.join(process.cwd(), 'uploads', 'media');
    const filename = `test-dialogue-${Date.now()}.mp3`;
    const fullPath = path.join(mediaDir, filename);
    fs.writeFileSync(fullPath, combined);
    console.log(`   -> File written to disk: ${fullPath} (${fs.statSync(fullPath).size} bytes)`);

    const [res]: any = await pool.query(
      `INSERT INTO media_files (title, filename, file_url, file_type, mime_type, file_size, duration_seconds, source_type, ai_prompt_text, ai_voice_code, ai_speed, created_by)
       VALUES (?, ?, ?, 'AUDIO', 'audio/mpeg', ?, 6, 'AI_TTS', ?, 'MULTI_SPEAKER', 1.00, 1)`,
      ['Test Dialogue Conversation', filename, `/uploads/media/${filename}`, combined.length, lines.map(l => `[${l.speaker}]: ${l.text}`).join('\n')]
    );
    console.log(`   -> Inserted to DB ID: ${res.insertId}`);
  } catch (e: any) {
    console.error('   ❌ Dialogue audio test failed:', e.message);
  }

  // Clean up test DB rows
  await pool.query("DELETE FROM media_files WHERE title LIKE 'Test %'");
  console.log('\n✅ Cleaned up temporary test DB rows.');
  await pool.end();
  process.exit(0);
}

testAllAudioGeneration();
