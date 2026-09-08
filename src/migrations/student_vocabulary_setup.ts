import pool from '../config/db';

export async function runStudentVocabularyMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('Running Student Vocabulary Room migration...');

    // 1. Create student_vocabularies table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS student_vocabularies (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        term VARCHAR(255) NOT NULL,
        normalized_term VARCHAR(255) NOT NULL,
        translation TEXT NULL,
        phonetic_ipa VARCHAR(255) NULL,
        context_sentence TEXT NULL,
        source_type ENUM('QUIZ', 'SPEAKING_AI', 'LESSON', 'MANUAL') NOT NULL DEFAULT 'QUIZ',
        source_id BIGINT UNSIGNED NULL,
        source_title VARCHAR(255) NULL,
        encounter_count INT NOT NULL DEFAULT 1,
        is_duplicate TINYINT(1) NOT NULL DEFAULT 0,
        first_encountered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_encountered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        mastery_level ENUM('NEW', 'LEARNING', 'MASTERED') NOT NULL DEFAULT 'NEW',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_vocab (user_id, normalized_term),
        INDEX idx_user_source (user_id, source_type),
        INDEX idx_user_mastery (user_id, mastery_level),
        CONSTRAINT fk_student_vocab_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create student_vocabulary_encounters table (Track history of duplicates/encounters)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS student_vocabulary_encounters (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        vocabulary_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        source_type ENUM('QUIZ', 'SPEAKING_AI', 'LESSON', 'MANUAL') NOT NULL,
        source_id BIGINT UNSIGNED NULL,
        source_title VARCHAR(255) NULL,
        context_sentence TEXT NULL,
        encounter_number INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_vocab_enc (vocabulary_id),
        INDEX idx_user_enc (user_id),
        CONSTRAINT fk_encounters_vocab FOREIGN KEY (vocabulary_id) REFERENCES student_vocabularies (id) ON DELETE CASCADE,
        CONSTRAINT fk_encounters_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Student Vocabulary Room migration completed successfully.');
  } catch (error: any) {
    console.error('Vocabulary migration error:', error);
    throw error;
  } finally {
    conn.release();
  }
}

// Direct CLI execution
if (require.main === module) {
  runStudentVocabularyMigration()
    .then(() => {
      console.log('Finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed:', err);
      process.exit(1);
    });
}
