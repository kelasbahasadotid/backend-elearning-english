import pool from '../config/db';

/**
 * Media Seeder — Data real berdasarkan konten kursus yang ada di database.
 * Data ini mencerminkan media yang wajar untuk platform e-learning bahasa Inggris.
 *
 * Struktur kursus yang ada:
 * - Course 1: "English Beginner Speaking"
 *   - Module 1: "Present Tense Structures"
 *     - Lesson 1 (VIDEO):    "Theory: Present Continuous Structure"
 *     - Lesson 2 (READING):  "Article: Common Exceptions & Adverbs"
 *     - Lesson 3 (QUIZ):     "Mixed Practice Quiz"
 *     - Lesson 4 (SPEAKING): "Pronunciation AI Challenge"
 *     - Lesson 5 (EXAM):     "TOEFL Mock Final Exam"
 */
async function seedMedia() {
  const connection = await pool.getConnection();
  try {
    console.log('🌱 Starting Media Seeder...');

    // Check current state
    const [existing]: any = await connection.query(
      'SELECT COUNT(*) as count FROM media_files WHERE deleted_at IS NULL'
    );
    const currentCount = existing[0].count;
    console.log(`📊 Current media_files rows: ${currentCount}`);

    if (currentCount > 0) {
      const forceFlag = process.argv.includes('--force');
      if (!forceFlag) {
        console.log(`\n⚠️  Sudah ada ${currentCount} record di media_files.`);
        console.log('   Jalankan dengan flag --force untuk menghapus dan seed ulang:');
        console.log('   npm run seed:media -- --force\n');
        return;
      }
      await connection.query('DELETE FROM media_files');
      await connection.query('ALTER TABLE media_files AUTO_INCREMENT = 1');
      console.log('🗑️  Existing media records cleared (--force).');
    }

    // === SEED DATA REAL ===
    // File URL menggunakan path relatif — file fisik bisa diupload terpisah.
    // Untuk AUDIO AI_TTS: tidak butuh file fisik, akan di-generate Edge-TTS.
    // Untuk VIDEO/IMAGE: path placeholder yang valid untuk production.

    const mediaRecords = [
      // ─────────────────────────────────────────────────────────────────────
      // AUDIO AI_TTS — dibuat dengan Edge-TTS untuk materi kursus
      // Target: Lesson 1 VIDEO (intro theory) & Lesson 2 READING (artikel)
      // ─────────────────────────────────────────────────────────────────────
      {
        title: 'Narasi: Present Continuous — Emma (British)',
        filename: 'tts-present-continuous-intro-emma.mp3',
        file_url: '/uploads/media/tts/tts-present-continuous-intro-emma.mp3',
        file_type: 'AUDIO',
        mime_type: 'audio/mpeg',
        file_size: 87040,
        duration_seconds: 6,
        source_type: 'AI_TTS',
        ai_prompt_text: 'The Present Continuous tense is used for actions happening right now. The formula is: Subject, am, is, or are, plus the verb ending in ing.',
        ai_voice_code: 'en-GB-EmmaNeural',
        ai_speed: 1.0,
        usage_count: 2,
        target_placement: 'English Beginner Speaking · Theory: Present Continuous Structure',
      },
      {
        title: 'Contoh Kalimat: I am studying English',
        filename: 'tts-example-i-am-studying-emma.mp3',
        file_url: '/uploads/media/tts/tts-example-i-am-studying-emma.mp3',
        file_type: 'AUDIO',
        mime_type: 'audio/mpeg',
        file_size: 51200,
        duration_seconds: 4,
        source_type: 'AI_TTS',
        ai_prompt_text: 'I am studying. She is cooking. They are playing soccer.',
        ai_voice_code: 'en-GB-EmmaNeural',
        ai_speed: 0.9,
        usage_count: 3,
        target_placement: 'English Beginner Speaking · Theory: Present Continuous Structure',
      },
      {
        title: 'Stative Verbs — Penjelasan & Contoh (Ryan)',
        filename: 'tts-stative-verbs-ryan.mp3',
        file_url: '/uploads/media/tts/tts-stative-verbs-ryan.mp3',
        file_type: 'AUDIO',
        mime_type: 'audio/mpeg',
        file_size: 96000,
        duration_seconds: 7,
        source_type: 'AI_TTS',
        ai_prompt_text: 'Stative verbs describe states, not actions, and are never used in the continuous form. For example: She knows the answer, NOT She is knowing the answer.',
        ai_voice_code: 'en-GB-RyanNeural',
        ai_speed: 0.9,
        usage_count: 1,
        target_placement: 'English Beginner Speaking · Article: Common Exceptions & Adverbs',
      },
      {
        title: 'Adverbs of Frequency — Always to Never (Emma)',
        filename: 'tts-adverbs-frequency-emma.mp3',
        file_url: '/uploads/media/tts/tts-adverbs-frequency-emma.mp3',
        file_type: 'AUDIO',
        mime_type: 'audio/mpeg',
        file_size: 102400,
        duration_seconds: 8,
        source_type: 'AI_TTS',
        ai_prompt_text: 'Adverbs of frequency go before the main verb. Always, usually, often, sometimes, rarely, never. She always arrives early. He is usually punctual.',
        ai_voice_code: 'en-GB-EmmaNeural',
        ai_speed: 0.85,
        usage_count: 2,
        target_placement: 'English Beginner Speaking · Article: Common Exceptions & Adverbs',
      },
      {
        title: 'Pronunciation: The -ing Spelling Rules',
        filename: 'tts-ing-spelling-rules-emma.mp3',
        file_url: '/uploads/media/tts/tts-ing-spelling-rules-emma.mp3',
        file_type: 'AUDIO',
        mime_type: 'audio/mpeg',
        file_size: 115200,
        duration_seconds: 9,
        source_type: 'AI_TTS',
        ai_prompt_text: 'Spelling rules for adding ing. Run becomes running. Make becomes making. Lie becomes lying. Play becomes playing.',
        ai_voice_code: 'en-GB-EmmaNeural',
        ai_speed: 0.85,
        usage_count: 1,
        target_placement: 'English Beginner Speaking · Article: Common Exceptions & Adverbs',
      },
      {
        title: 'Quiz Instruction: What to Expect (Andrew)',
        filename: 'tts-quiz-instruction-andrew.mp3',
        file_url: '/uploads/media/tts/tts-quiz-instruction-andrew.mp3',
        file_type: 'AUDIO',
        mime_type: 'audio/mpeg',
        file_size: 72000,
        duration_seconds: 5,
        source_type: 'AI_TTS',
        ai_prompt_text: 'This quiz contains twelve questions covering all five question types. The passing score is seventy percent. Good luck!',
        ai_voice_code: 'en-US-AndrewNeural',
        ai_speed: 1.0,
        usage_count: 0,
        target_placement: null,
      },
      {
        title: 'Speaking Tips: How to Maximize Your Score',
        filename: 'tts-speaking-tips-emma.mp3',
        file_url: '/uploads/media/tts/tts-speaking-tips-emma.mp3',
        file_type: 'AUDIO',
        mime_type: 'audio/mpeg',
        file_size: 128000,
        duration_seconds: 10,
        source_type: 'AI_TTS',
        ai_prompt_text: 'Speak clearly and at a natural conversational pace. Open your mouth fully. Stress key content words like nouns and verbs. The AI evaluates phoneme accuracy, word stress, and sentence rhythm.',
        ai_voice_code: 'en-GB-EmmaNeural',
        ai_speed: 0.9,
        usage_count: 1,
        target_placement: null,
      },

      // ─────────────────────────────────────────────────────────────────────
      // VIDEO — Materi teori dan YouTube embed
      // ─────────────────────────────────────────────────────────────────────
      {
        title: 'Present Continuous Tense — Materi Teori (MP4)',
        filename: 'present-continuous-theory.mp4',
        file_url: '/uploads/media/video/present-continuous-theory.mp4',
        file_type: 'VIDEO',
        mime_type: 'video/mp4',
        file_size: 22500000,
        duration_seconds: 900,
        source_type: 'UPLOAD',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 1,
        target_placement: 'English Beginner Speaking · Theory: Present Continuous Structure',
      },
      {
        title: 'BBC Learning English — Present Tense Basics',
        filename: 'bbc-present-tense-basics',
        file_url: 'https://www.youtube.com/watch?v=muSdaqO1h_M',
        file_type: 'LINK',
        mime_type: 'video/youtube',
        file_size: 0,
        duration_seconds: 424,
        source_type: 'EXTERNAL_LINK',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 2,
        target_placement: 'English Beginner Speaking · Theory: Present Continuous Structure',
      },
      {
        title: 'English with Lucy — Present Continuous vs Simple Present',
        filename: 'english-with-lucy-tense-compare',
        file_url: 'https://www.youtube.com/watch?v=QHCbxh9E2ac',
        file_type: 'LINK',
        mime_type: 'video/youtube',
        file_size: 0,
        duration_seconds: 612,
        source_type: 'EXTERNAL_LINK',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 1,
        target_placement: 'English Beginner Speaking · Theory: Present Continuous Structure',
      },
      {
        title: 'Pronunciation Guide — TH Sound & Vowel Length',
        filename: 'pronunciation-th-vowel.mp4',
        file_url: '/uploads/media/video/pronunciation-th-vowel.mp4',
        file_type: 'VIDEO',
        mime_type: 'video/mp4',
        file_size: 14800000,
        duration_seconds: 540,
        source_type: 'UPLOAD',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 0,
        target_placement: null,
      },

      // ─────────────────────────────────────────────────────────────────────
      // GAMBAR — Diagram tata bahasa dan infografis
      // ─────────────────────────────────────────────────────────────────────
      {
        title: 'Diagram: Present Continuous vs Simple Present',
        filename: 'diagram-tense-comparison.png',
        file_url: '/uploads/media/image/diagram-tense-comparison.png',
        file_type: 'IMAGE',
        mime_type: 'image/png',
        file_size: 189440,
        duration_seconds: 0,
        source_type: 'UPLOAD',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 2,
        target_placement: 'English Beginner Speaking · Article: Common Exceptions & Adverbs',
      },
      {
        title: 'Infografis: Adverbs of Frequency Chart',
        filename: 'infografis-adverbs-frequency.jpg',
        file_url: '/uploads/media/image/infografis-adverbs-frequency.jpg',
        file_type: 'IMAGE',
        mime_type: 'image/jpeg',
        file_size: 245760,
        duration_seconds: 0,
        source_type: 'UPLOAD',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 1,
        target_placement: 'English Beginner Speaking · Article: Common Exceptions & Adverbs',
      },
      {
        title: 'Tabel: Stative Verbs Lengkap',
        filename: 'tabel-stative-verbs.png',
        file_url: '/uploads/media/image/tabel-stative-verbs.png',
        file_type: 'IMAGE',
        mime_type: 'image/png',
        file_size: 134000,
        duration_seconds: 0,
        source_type: 'UPLOAD',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 1,
        target_placement: null,
      },

      // ─────────────────────────────────────────────────────────────────────
      // DOKUMEN — Materi pendukung PDF
      // ─────────────────────────────────────────────────────────────────────
      {
        title: 'Modul PDF: Present Tense Structures — Lengkap',
        filename: 'modul-present-tense-structures.pdf',
        file_url: '/uploads/media/doc/modul-present-tense-structures.pdf',
        file_type: 'DOCUMENT',
        mime_type: 'application/pdf',
        file_size: 1843200,
        duration_seconds: 0,
        source_type: 'UPLOAD',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 1,
        target_placement: 'English Beginner Speaking · Article: Common Exceptions & Adverbs',
      },
      {
        title: 'Worksheet: -ing Spelling Rules Practice',
        filename: 'worksheet-ing-spelling.pdf',
        file_url: '/uploads/media/doc/worksheet-ing-spelling.pdf',
        file_type: 'DOCUMENT',
        mime_type: 'application/pdf',
        file_size: 512000,
        duration_seconds: 0,
        source_type: 'UPLOAD',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 0,
        target_placement: null,
      },
      {
        title: 'Panduan Siswa — TOEFL Mock Exam Strategy',
        filename: 'panduan-toefl-strategy.pdf',
        file_url: '/uploads/media/doc/panduan-toefl-strategy.pdf',
        file_type: 'DOCUMENT',
        mime_type: 'application/pdf',
        file_size: 768000,
        duration_seconds: 0,
        source_type: 'UPLOAD',
        ai_prompt_text: null,
        ai_voice_code: null,
        ai_speed: 1.0,
        usage_count: 1,
        target_placement: null,
      },
    ];

    // Insert semua records
    for (const rec of mediaRecords) {
      await connection.execute(
        `INSERT INTO media_files
          (title, filename, file_url, file_type, mime_type, file_size, duration_seconds,
           source_type, ai_prompt_text, ai_voice_code, ai_speed, usage_count, target_placement, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1)`,
        [
          rec.title, rec.filename, rec.file_url, rec.file_type, rec.mime_type,
          rec.file_size, rec.duration_seconds, rec.source_type,
          rec.ai_prompt_text ?? null, rec.ai_voice_code ?? null, rec.ai_speed,
          rec.usage_count, rec.target_placement ?? null
        ]
      );
      console.log(`  ✅ [${rec.file_type}] ${rec.title}`);
    }

    console.log(`\n🎉 Media seeder selesai! Total: ${mediaRecords.length} records.`);
    console.log('\n📊 Summary:');
    const [summary]: any = await connection.query(`
      SELECT file_type, source_type, COUNT(*) as count
      FROM media_files WHERE deleted_at IS NULL
      GROUP BY file_type, source_type ORDER BY file_type
    `);
    for (const row of summary) {
      console.log(`  ${row.file_type} (${row.source_type}): ${row.count}`);
    }

  } catch (err: any) {
    console.error('❌ Seeder error:', err.message);
  } finally {
    connection.release();
    await pool.end();
    process.exit(0);
  }
}

seedMedia();
