import pool from '../src/config/db';

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS media_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_type ENUM('AUDIO', 'VIDEO', 'IMAGE', 'DOCUMENT', 'LINK', 'OTHER') NOT NULL DEFAULT 'OTHER',
        mime_type VARCHAR(100) DEFAULT NULL,
        file_size BIGINT DEFAULT 0,
        duration_seconds INT DEFAULT 0,
        source_type ENUM('UPLOAD', 'AI_TTS', 'EXTERNAL_LINK') NOT NULL DEFAULT 'UPLOAD',
        ai_prompt_text TEXT DEFAULT NULL,
        ai_voice_code VARCHAR(100) DEFAULT NULL,
        ai_speed DECIMAL(3,2) DEFAULT 1.00,
        usage_count INT DEFAULT 0,
        target_placement VARCHAR(255) DEFAULT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_file_type (file_type),
        INDEX idx_source_type (source_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ media_files table ready');

    const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM media_files');
    if (rows[0].count === 0) {
      await pool.query(`
        INSERT INTO media_files (title, filename, file_url, file_type, mime_type, file_size, duration_seconds, source_type, ai_prompt_text, ai_voice_code, ai_speed, usage_count, target_placement) VALUES
        ('morning.mp3', 'morning.mp3', '/uploads/media/morning.mp3', 'AUDIO', 'audio/mpeg', 64500, 4, 'UPLOAD', NULL, NULL, 1.00, 3, 'Speaking Basics · Topik 01'),
        ('greetings-intro.mp4', 'greetings-intro.mp4', '/uploads/media/greetings-intro.mp4', 'VIDEO', 'video/mp4', 14200000, 134, 'UPLOAD', NULL, NULL, 1.00, 1, 'Unit 1 · Pengenalan'),
        ('sapaan-pagi.jpg', 'sapaan-pagi.jpg', '/uploads/media/sapaan-pagi.jpg', 'IMAGE', 'image/jpeg', 245760, 0, 'UPLOAD', NULL, NULL, 1.00, 2, 'Kamus Bergambar'),
        ('good-afternoon.mp3', 'good-afternoon.mp3', '/uploads/media/good-afternoon.mp3', 'AUDIO', 'audio/mpeg', 48000, 3, 'UPLOAD', NULL, NULL, 1.00, 0, NULL),
        ('good-evening.mp3', 'good-evening.mp3', '/uploads/media/good-evening.mp3', 'AUDIO', 'audio/mpeg', 51000, 3, 'AI_TTS', 'Good evening! How was your day?', 'en-GB-EmmaNeural', 1.00, 0, 'Speaking Basics · Topik 01'),
        ('panduan-belajar.pdf', 'panduan-belajar.pdf', '/uploads/media/panduan-belajar.pdf', 'DOCUMENT', 'application/pdf', 1153433, 0, 'UPLOAD', NULL, NULL, 1.00, 1, 'Panduan Umum Siswa'),
        ('intonasi.mp4', 'intonasi.mp4', '/uploads/media/intonasi.mp4', 'VIDEO', 'video/mp4', 9800000, 98, 'UPLOAD', NULL, NULL, 1.00, 0, NULL),
        ('Greetings in English', 'Greetings in English', 'https://www.youtube.com/watch?v=Fw0rdh9XxBo', 'LINK', 'video/youtube', 0, 134, 'EXTERNAL_LINK', NULL, NULL, 1.00, 2, 'Listening Section'),
        ('Small talk at work', 'Small talk at work', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'LINK', 'video/youtube', 0, 258, 'EXTERNAL_LINK', NULL, NULL, 1.00, 0, NULL);
      `);
      console.log('✅ Demo records added');
    }
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

run();
