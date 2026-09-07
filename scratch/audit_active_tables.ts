import pool from '../src/config/db';
import * as fs from 'fs';
import * as path from 'path';

async function checkDetails() {
  const reportPath = path.resolve(__dirname, 'table_analysis_report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  console.log(`\nAnalyzing ${report.activeTables.length} currently tagged active tables...`);

  // Let's filter out tables where references are only comments or non-SQL references
  const actuallyUsed: { table: string; rowCount: number; refFiles: string[] }[] = [];
  const suspiciousActive: { table: string; rowCount: number; refFiles: string[] }[] = [];

  for (const table of report.activeTables) {
    const refs = report.tableReferences[table].files;
    const count = report.tableCounts[table];

    // Filter files to see if it's referenced in src/ controllers, models, routes, or services
    const codeRefs = refs.filter((f: string) => 
      !f.endsWith('.sql') && 
      !f.includes('scratch/') && 
      !f.includes('docs/swagger') &&
      !f.includes('test_')
    );

    if (codeRefs.length > 0) {
      actuallyUsed.push({ table, rowCount: count, refFiles: codeRefs });
    } else {
      suspiciousActive.push({ table, rowCount: count, refFiles: refs });
    }
  }

  console.log(`\nACTUALLY USED IN CORE CODE: ${actuallyUsed.length}`);
  console.log(`SUSPICIOUS / ONLY IN SQL DUMPS OR DOCS: ${suspiciousActive.length}`);

  if (suspiciousActive.length > 0) {
    console.log('\n--- SUSPICIOUS / ONLY IN SQL DUMPS / DOCS ---');
    suspiciousActive.forEach(s => {
      console.log(`- ${s.table} (Rows: ${s.rowCount}, Files: ${s.refFiles.join(', ')})`);
    });
  }

  fs.writeFileSync(
    path.resolve(__dirname, 'active_tables_audit.json'),
    JSON.stringify({ actuallyUsed, suspiciousActive }, null, 2)
  );

  process.exit(0);
}

checkDetails().catch(e => {
  console.error(e);
  process.exit(1);
});
