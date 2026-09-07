import pool from '../src/config/db';
import * as fs from 'fs';
import * as path from 'path';

async function analyze() {
  const [tablesResult]: any = await pool.query('SHOW TABLES');
  const allTables: string[] = tablesResult.map((t: any) => Object.values(t)[0]);
  console.log(`Total database tables: ${allTables.length}`);

  // Get table row counts
  const tableCounts: Record<string, number> = {};
  for (const table of allTables) {
    try {
      const [cnt]: any = await pool.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      tableCounts[table] = cnt[0]?.count || 0;
    } catch (e: any) {
      tableCounts[table] = -1;
    }
  }

  // Scan codebase for references
  const backendSrc = path.resolve(__dirname, '../src');
  const frontendSrc = path.resolve(__dirname, '../../frontend-elearning-english/src');

  function getAllFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.sql')) {
        results.push(fullPath);
      }
    });
    return results;
  }

  const allCodeFiles = [...getAllFiles(backendSrc), ...getAllFiles(frontendSrc)];
  console.log(`Total code files scanned: ${allCodeFiles.length}`);

  const tableReferences: Record<string, { files: string[]; count: number }> = {};
  for (const table of allTables) {
    tableReferences[table] = { files: [], count: 0 };
  }

  for (const filePath of allCodeFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const table of allTables) {
      // Regex word boundary or backtick/quote
      const regex = new RegExp(`\\b${table}\\b|[\`"']${table}[\`"']`, 'i');
      if (regex.test(content)) {
        tableReferences[table].files.push(path.relative(path.resolve(__dirname, '../..'), filePath));
        tableReferences[table].count++;
      }
    }
  }

  // Check Foreign Key constraints in information_schema
  const [fkResult]: any = await pool.query(`
    SELECT TABLE_NAME, REFERENCED_TABLE_NAME 
    FROM information_schema.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `);

  const relations: Record<string, { references: string[]; referencedBy: string[] }> = {};
  for (const table of allTables) {
    relations[table] = { references: [], referencedBy: [] };
  }
  for (const fk of fkResult) {
    if (relations[fk.TABLE_NAME]) {
      relations[fk.TABLE_NAME].references.push(fk.REFERENCED_TABLE_NAME);
    }
    if (relations[fk.REFERENCED_TABLE_NAME]) {
      relations[fk.REFERENCED_TABLE_NAME].referencedBy.push(fk.TABLE_NAME);
    }
  }

  const activeTables: string[] = [];
  const unusedTables: string[] = [];

  for (const table of allTables) {
    const refCount = tableReferences[table].count;
    const hasFk = relations[table].references.length > 0 || relations[table].referencedBy.length > 0;
    const rowCount = tableCounts[table];

    // Check backup tables explicitly
    const isBackup = table.includes('_bak') || table.includes('bak27') || table.endsWith('_old') || table.endsWith('_temp');

    if ((refCount === 0 && !hasFk) || isBackup) {
      unusedTables.push(table);
    } else {
      activeTables.push(table);
    }
  }

  console.log('\n=========================================');
  console.log(`ACTIVE TABLES COUNT: ${activeTables.length}`);
  console.log(`UNUSED / DEAD TABLES COUNT: ${unusedTables.length}`);
  console.log('=========================================\n');

  console.log('--- LIST OF UNUSED / DEAD TABLES ---');
  unusedTables.forEach(t => {
    console.log(`- ${t} (Rows: ${tableCounts[t]}, CodeRefs: ${tableReferences[t].count}, FKs: ${relations[t].references.length + relations[t].referencedBy.length})`);
  });

  // Save report
  fs.writeFileSync(
    path.resolve(__dirname, 'table_analysis_report.json'),
    JSON.stringify({ activeTables, unusedTables, tableCounts, tableReferences, relations }, null, 2)
  );

  console.log('\nReport saved to scratch/table_analysis_report.json');
  process.exit(0);
}

analyze().catch(err => {
  console.error(err);
  process.exit(1);
});
