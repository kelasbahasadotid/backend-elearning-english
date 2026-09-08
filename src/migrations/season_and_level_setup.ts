import pool from '../config/db';

export async function runSeasonAndLevelMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('Running Season & Gamification Level migration...');

    // 1. Create leaderboard_seasons table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_seasons (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        reset_schedule_type ENUM('MANUAL', 'MONTHLY', 'QUARTERLY', 'CUSTOM') NOT NULL DEFAULT 'MONTHLY',
        status ENUM('ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create leaderboard_season_history table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_season_history (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        season_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        final_rank INT NOT NULL,
        final_xp INT NOT NULL DEFAULT 0,
        final_level INT NOT NULL DEFAULT 1,
        level_name VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_season_user (season_id, user_id),
        CONSTRAINT fk_season_hist_season FOREIGN KEY (season_id) REFERENCES leaderboard_seasons (id) ON DELETE CASCADE,
        CONSTRAINT fk_season_hist_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Create gamification_levels table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS gamification_levels (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        level_number INT NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        min_xp INT NOT NULL DEFAULT 0,
        badge_icon VARCHAR(100) NULL,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Add season_id column to xp_transactions if missing
    const [xpCols] = await conn.query('SHOW COLUMNS FROM xp_transactions') as any;
    const hasSeasonId = xpCols.some((c: any) => c.Field === 'season_id');
    if (!hasSeasonId) {
      console.log('Adding season_id column to xp_transactions...');
      await conn.query(`
        ALTER TABLE xp_transactions 
        ADD COLUMN season_id BIGINT UNSIGNED NULL AFTER user_id,
        ADD INDEX idx_xp_tx_season (season_id)
      `);
    }

    // 5. Seed default gamification levels if empty
    const [levelCountRows] = await conn.query('SELECT COUNT(*) as count FROM gamification_levels') as any;
    if (levelCountRows[0].count === 0) {
      console.log('Seeding initial gamification levels 1-10...');
      const defaultLevels = [
        { level_number: 1, name: 'Novice Speaker', min_xp: 0, badge_icon: '🌱', description: 'Tingkat permulaan perjalanan belajar bahasa Inggris' },
        { level_number: 2, name: 'Elementary Explorer', min_xp: 200, badge_icon: '⭐', description: 'Mulai menguasai kosakata dasar dan percakapan ringan' },
        { level_number: 3, name: 'Vocabulary Builder', min_xp: 500, badge_icon: '🔥', description: 'Kosakata semakin bertambah dan lancar berdialog' },
        { level_number: 4, name: 'Grammar Navigator', min_xp: 900, badge_icon: '🎯', description: 'Memahami kaidah tata bahasa dan struktur kalimat' },
        { level_number: 5, name: 'Fluent Conversationalist', min_xp: 1400, badge_icon: '💎', description: 'Mampu berbicara percaya diri di berbagai topik' },
        { level_number: 6, name: 'Advanced Communicator', min_xp: 2000, badge_icon: '🚀', description: 'Komunikasi tingkat lanjut dengan pelafalan presisi' },
        { level_number: 7, name: 'Language Specialist', min_xp: 2700, badge_icon: '🏆', description: 'Penguasaan tingkat tinggi dalam berbagai tes dan latihan' },
        { level_number: 8, name: 'Master Orator', min_xp: 3500, badge_icon: '👑', description: 'Kefasihan dan pemahaman setara penutur mahir' },
        { level_number: 9, name: 'Grand Scholar', min_xp: 4500, badge_icon: '🌌', description: 'Prestasi gemilang dan konsistensi luar biasa' },
        { level_number: 10, name: 'Language Legend', min_xp: 6000, badge_icon: '⚡', description: 'Legenda belajar dengan pencapaian tertinggi' }
      ];

      for (const lvl of defaultLevels) {
        await conn.query(
          'INSERT INTO gamification_levels (level_number, name, min_xp, badge_icon, description) VALUES (?, ?, ?, ?, ?)',
          [lvl.level_number, lvl.name, lvl.min_xp, lvl.badge_icon, lvl.description]
        );
      }
    }

    // 6. Seed initial active Season 1 if none exists
    const [seasonCountRows] = await conn.query('SELECT COUNT(*) as count FROM leaderboard_seasons') as any;
    if (seasonCountRows[0].count === 0) {
      console.log('Seeding initial active Season 1...');
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const [res] = await conn.query(
        `INSERT INTO leaderboard_seasons (title, code, start_date, end_date, reset_schedule_type, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [
          `Season 1 - Musim Belajar ${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`,
          `SEASON-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          startOfMonth,
          endOfMonth,
          'MONTHLY'
        ]
      ) as any;

      // Associate existing transactions with Season 1
      if (res.insertId) {
        await conn.query('UPDATE xp_transactions SET season_id = ? WHERE season_id IS NULL', [res.insertId]);
      }
    }

    console.log('Season & Gamification Level migration completed successfully.');
  } catch (error: any) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    conn.release();
  }
}

// Allow direct execution
if (require.main === module) {
  runSeasonAndLevelMigration()
    .then(() => {
      console.log('Migration finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
