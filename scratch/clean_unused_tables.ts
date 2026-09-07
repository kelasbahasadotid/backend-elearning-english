import * as fs from 'fs';
import * as path from 'path';
import pool from '../src/config/db';

async function performCleanDatabase() {
  console.log('--- STARTING DATABASE TABLES CLEANUP ---');

  const auditPath = path.resolve(__dirname, 'db_audit_final.json');
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

  // Tables to drop:
  // All deadUnused tables + menus, pages, sliders, levels (which are 0 rows and not in backend DB)
  const deadTables: string[] = [
    ...audit.deadUnused,
    'menus',
    'pages',
    'sliders',
    'levels'
  ];

  // Unique list
  const uniqueDead = Array.from(new Set(deadTables));
  console.log(`Identified ${uniqueDead.length} unused/dead tables to safely drop.`);

  // Disable FK checks, drop each unused table
  await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

  let droppedCount = 0;
  for (const table of uniqueDead) {
    try {
      await pool.query(`DROP TABLE IF EXISTS \`${table}\``);
      droppedCount++;
      console.log(`[DROPPED] \`${table}\``);
    } catch (e: any) {
      console.error(`[ERROR DROPPING] ${table}:`, e.message);
    }
  }

  await pool.query('SET FOREIGN_KEY_CHECKS = 1;');
  console.log(`\nSuccessfully dropped ${droppedCount} unused tables.`);

  // Verify remaining active tables
  const [remainingResult]: any = await pool.query('SHOW TABLES');
  const remainingTables = remainingResult.map((r: any) => Object.values(r)[0]);

  console.log(`\n==============================================`);
  console.log(`REMAINING CORE ACTIVE TABLES: ${remainingTables.length}`);
  console.log(`==============================================`);

  let totalRows = 0;
  for (const t of remainingTables) {
    const [cnt]: any = await pool.query(`SELECT COUNT(*) as c FROM \`${t}\``);
    const count = cnt[0].c;
    totalRows += count;
    console.log(`- \`${t}\`: ${count} rows`);
  }

  console.log(`\nTotal rows preserved across all ${remainingTables.length} core tables: ${totalRows}`);

  process.exit(0);
}

performCleanDatabase().catch(e => {
  console.error(e);
  process.exit(1);
});
