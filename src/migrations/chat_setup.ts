import pool from '../config/db';

export async function runChatMigration(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    console.log('Running Realtime Chat tables migration...');

    // 1. Create chat_rooms table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        student_id BIGINT UNSIGNED NOT NULL UNIQUE,
        last_message TEXT NULL,
        last_message_at DATETIME NULL,
        last_sender_id BIGINT UNSIGNED NULL,
        unread_student_count INT UNSIGNED NOT NULL DEFAULT 0,
        unread_admin_count INT UNSIGNED NOT NULL DEFAULT 0,
        status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chat_rooms_student (student_id),
        INDEX idx_chat_rooms_last_msg (last_message_at),
        CONSTRAINT fk_chat_rooms_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_rooms_last_sender FOREIGN KEY (last_sender_id) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create chat_messages table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_id BIGINT UNSIGNED NOT NULL,
        sender_id BIGINT UNSIGNED NOT NULL,
        sender_role ENUM('STUDENT', 'ADMIN', 'SUPERADMIN', 'TUTOR') NOT NULL DEFAULT 'STUDENT',
        message TEXT NOT NULL,
        attachment_url VARCHAR(500) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_messages_room_created (room_id, created_at),
        INDEX idx_chat_messages_unread (room_id, is_read),
        CONSTRAINT fk_chat_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms (id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Realtime Chat tables migration completed successfully.');
  } catch (error: any) {
    console.error('❌ Realtime Chat migration error:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}
