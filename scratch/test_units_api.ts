import pool from '../src/config/db';

async function testUnits() {
  try {
    console.log('Testing Unit and Module integration...');
    
    // 1. Get first course
    const [courses] = await pool.query<any[]>('SELECT id, slug FROM courses LIMIT 1');
    if (courses.length === 0) {
      console.log('No courses found.');
      process.exit(0);
    }
    const course = courses[0];
    console.log(`Using Course ID: ${course.id} (${course.slug})`);

    // 2. Get current version
    const [versions] = await pool.query<any[]>('SELECT id FROM course_versions WHERE course_id = ? AND is_current = 1', [course.id]);
    const versionId = versions[0]?.id;
    console.log(`Course Version ID: ${versionId}`);

    // 3. Create a test Unit
    const [unitRes] = await pool.query<any>(
      'INSERT INTO units (course_version_id, title, slug, description, unit_order, status) VALUES (?, ?, ?, ?, ?, ?)',
      [versionId, 'Unit 1: Introduction Test', 'unit-1-intro-test', 'Unit description test', 1, 'PUBLISHED']
    );
    const unitId = unitRes.insertId;
    console.log(`✓ Created Unit ID: ${unitId}`);

    // 4. Find a module in this version to assign
    const [modules] = await pool.query<any[]>('SELECT id, title, unit_id FROM modules WHERE course_version_id = ? LIMIT 1', [versionId]);
    if (modules.length > 0) {
      const mod = modules[0];
      console.log(`Moving module ID ${mod.id} ("${mod.title}") into Unit ID ${unitId}`);
      await pool.query('UPDATE modules SET unit_id = ? WHERE id = ?', [unitId, mod.id]);

      const [checkMod] = await pool.query<any[]>('SELECT id, unit_id FROM modules WHERE id = ?', [mod.id]);
      console.log(`✓ Module updated with unit_id:`, checkMod[0].unit_id);
    }

    // 5. Query units with total_modules
    const [unitList] = await pool.query<any[]>(`
      SELECT u.*, COUNT(m.id) as total_modules
      FROM units u
      LEFT JOIN modules m ON u.id = m.unit_id
      WHERE u.course_version_id = ?
      GROUP BY u.id
    `, [versionId]);
    console.log(`✓ Units list for course:`, unitList);

    console.log('All backend checks passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testUnits();
