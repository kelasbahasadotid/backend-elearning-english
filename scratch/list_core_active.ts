import * as fs from 'fs';
import * as path from 'path';

async function listActive() {
  const audit = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'active_tables_audit.json'), 'utf8'));
  console.log(`\n================================`);
  console.log(`GENUINE CORE ACTIVE TABLES (${audit.actuallyUsed.length}):`);
  console.log(`================================`);
  audit.actuallyUsed.forEach((item: any, idx: number) => {
    console.log(`${idx + 1}. \`${item.table}\` (${item.rowCount} rows) -> Used in: ${item.refFiles.slice(0, 3).join(', ')}${item.refFiles.length > 3 ? ` + ${item.refFiles.length - 3} more` : ''}`);
  });
}

listActive();
