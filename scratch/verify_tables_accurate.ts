import * as fs from 'fs';
import * as path from 'path';
import pool from '../src/config/db';

async function run() {
  const [allTablesResult]: any = await pool.query('SHOW TABLES');
  const allDbTables: string[] = allTablesResult.map((r: any) => Object.values(r)[0]);
  console.log(`Total tables currently in DB: ${allDbTables.length}`);

  function getFiles(dir: string): string[] {
    let res: string[] = [];
    if (!fs.existsSync(dir)) return res;
    for (const item of fs.readdirSync(dir)) {
      const p = path.join(dir, item);
      if (fs.statSync(p).isDirectory()) {
        res = res.concat(getFiles(p));
      } else if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx')) {
        res.push(p);
      }
    }
    return res;
  }

  const backendFiles = getFiles(path.resolve(__dirname, '../src'));
  const frontendFiles = getFiles(path.resolve(__dirname, '../../frontend-elearning-english/src'));

  const fileContents = [
    ...backendFiles.map(f => ({ file: path.relative(path.resolve(__dirname, '..'), f), content: fs.readFileSync(f, 'utf8'), type: 'backend' })),
    ...frontendFiles.map(f => ({ file: path.relative(path.resolve(__dirname, '../../frontend-elearning-english'), f), content: fs.readFileSync(f, 'utf8'), type: 'frontend' }))
  ];

  const tableStats: Record<string, { backendRefs: string[]; frontendRefs: string[]; rowCount: number }> = {};

  for (const table of allDbTables) {
    let rowCount = 0;
    try {
      const [cnt]: any = await pool.query(`SELECT COUNT(*) as c FROM \`${table}\``);
      rowCount = cnt[0].c;
    } catch(e) {
      rowCount = -1;
    }

    const bRefs: string[] = [];
    const fRefs: string[] = [];

    const regex = new RegExp(`\\b${table}\\b`, 'i');

    for (const item of fileContents) {
      if (regex.test(item.content)) {
        if (item.type === 'backend') {
          // exclude swagger.ts and migrations if you want pure logic
          if (!item.file.includes('swagger.ts') && !item.file.includes('schema') && !item.file.includes('analyze_')) {
            bRefs.push(item.file);
          }
        } else {
          fRefs.push(item.file);
        }
      }
    }

    tableStats[table] = { backendRefs: bRefs, frontendRefs: fRefs, rowCount };
  }

  const coreActive: string[] = [];
  const deadUnused: string[] = [];

  for (const table of allDbTables) {
    const isBak = table.includes('_bak') || table.includes('bak27');
    const hasRefs = tableStats[table].backendRefs.length > 0 || tableStats[table].frontendRefs.length > 0;

    if (!isBak && hasRefs) {
      coreActive.push(table);
    } else {
      deadUnused.push(table);
    }
  }

  console.log(`\n================================`);
  console.log(`SUMMARY OF TABLES AUDIT:`);
  console.log(`- Core Active Tables: ${coreActive.length}`);
  console.log(`- Dead / Unused Tables to Drop: ${deadUnused.length}`);
  console.log(`================================\n`);

  console.log('--- CORE ACTIVE TABLES ---');
  coreActive.forEach(t => {
    console.log(`[ACTIVE] ${t} (Rows: ${tableStats[t].rowCount}, Backend Files: ${tableStats[t].backendRefs.length})`);
  });

  console.log('\n--- DEAD / UNUSED TABLES ---');
  deadUnused.forEach(t => {
    console.log(`[DEAD] ${t} (Rows: ${tableStats[t].rowCount})`);
  });

  fs.writeFileSync(path.resolve(__dirname, 'db_audit_final.json'), JSON.stringify({ coreActive, deadUnused, tableStats }, null, 2));

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
