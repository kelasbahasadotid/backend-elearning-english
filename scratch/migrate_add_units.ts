import pool from '../src/config/db';

async function migrate() {
  try {
    console.log('--- Checking and migrating database for Units ---');

    // 1. Create units table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS units (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        course_version_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
        slug VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        description TEXT COLLATE utf8mb4_unicode_ci,
        unit_order INT NOT NULL DEFAULT 1,
        status ENUM('DRAFT','PUBLISHED','ARCHIVED') COLLATE utf8mb4_unicode_ci DEFAULT 'PUBLISHED',
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY fk_unit_course_version (course_version_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Table units ensured');

    // 2. Check if unit_id column exists on modules table
    const [cols] = await pool.query<any[]>(`
      SHOW COLUMNS FROM modules LIKE 'unit_id';
    `);

    if (cols.length === 0) {
      console.log('Adding unit_id to modules table...');
      await pool.query(`
        ALTER TABLE modules 
        ADD COLUMN unit_id BIGINT UNSIGNED DEFAULT NULL AFTER course_version_id,
        ADD KEY fk_module_unit (unit_id);
      `);
      console.log('✓ Column unit_id added to modules');
    } else {
      console.log('✓ Column unit_id already exists on modules');
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
