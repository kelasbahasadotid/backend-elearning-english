import fs from 'fs';
import readline from 'readline';
import path from 'path';

async function main() {
  const tableDefinitions: Map<string, { createLine: number; sqlSnippet: string }> = new Map();
  
  // 1. Read database.sql line by line
  const rl = readline.createInterface({
    input: fs.createReadStream('database.sql', { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  let currentTable: string | null = null;
  let currentSnippet = '';
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    const createMatch = line.match(/CREATE TABLE (?:IF NOT EXISTS )?[`]?([a-zA-Z0-9_]+)[`]?/i);
    if (createMatch) {
      currentTable = createMatch[1].toLowerCase();
      currentSnippet = line + '\n';
      tableDefinitions.set(currentTable, { createLine: lineNum, sqlSnippet: currentSnippet });
    } else if (currentTable) {
      currentSnippet += line + '\n';
      if (line.includes(';')) {
        const entry = tableDefinitions.get(currentTable);
        if (entry) {
          entry.sqlSnippet = currentSnippet;
        }
        currentTable = null;
        currentSnippet = '';
      }
    }
  }

  console.log(`Found ${tableDefinitions.size} tables defined in database.sql\n`);

  // 2. Scan all backend TS files for table usages
  function getFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
          results = results.concat(getFiles(fullPath));
        }
      } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx')) {
        results.push(fullPath);
      }
    });
    return results;
  }

  const backendFiles = getFiles('./src');
  const frontendFiles = getFiles('../frontend-elearning-english/src');
  const allSourceFiles = [...backendFiles, ...frontendFiles];

  console.log(`Scanning ${allSourceFiles.length} source code files for table references...\n`);

  const fileContents = allSourceFiles.map(f => ({
    file: f,
    content: fs.readFileSync(f, 'utf8').toLowerCase()
  }));

  const tableUsage: Record<string, { count: number; files: string[]; hasFk: boolean }> = {};

  for (const [tableName, info] of tableDefinitions.entries()) {
    const matchingFiles: string[] = [];
    const lowerTable = tableName.toLowerCase();

    // Regex to match exact table name as whole word or in SQL contexts
    const regex = new RegExp(`\\b${lowerTable}\\b`, 'i');

    for (const fc of fileContents) {
      // Don't count dbSeeder or scratch tests as production code, but track them
      if (regex.test(fc.content)) {
        matchingFiles.push(fc.file);
      }
    }

    const hasFk = /FOREIGN KEY/i.test(info.sqlSnippet) || /REFERENCES/i.test(info.sqlSnippet);

    tableUsage[tableName] = {
      count: matchingFiles.length,
      files: matchingFiles,
      hasFk
    };
  }

  console.log('=== TABEL YANG DIGUNAKAN DI BACKEND/FRONTEND ===');
  const usedTables: string[] = [];
  const unusedTables: string[] = [];

  for (const [table, usage] of Object.entries(tableUsage)) {
    // filter out files that are only scratch or seeders
    const prodFiles = usage.files.filter(f => !f.includes('scratch') && !f.includes('test_') && !f.includes('dbSeeder') && !f.includes('mediaSeeder'));
    if (prodFiles.length > 0) {
      usedTables.push(table);
      console.log(`[USED] ${table} -> Referenced in ${prodFiles.length} production files`);
    } else {
      unusedTables.push(table);
      console.log(`[UNUSED / DEAD] ${table} -> 0 production references (Total refs including seeders/scratch: ${usage.files.length})`);
    }
  }

  console.log('\n=============================================');
  console.log(`TOTAL TABLES: ${tableDefinitions.size}`);
  console.log(`USED TABLES: ${usedTables.length}`);
  console.log(`UNUSED / CANDIDATE FOR DELETION: ${unusedTables.length}`);
  console.log('=============================================');
  console.log('Unused Tables List:', unusedTables);

  // Write detail report to scratch/table_audit_report.json
  fs.writeFileSync('scratch/table_audit_report.json', JSON.stringify({
    total: tableDefinitions.size,
    usedCount: usedTables.length,
    unusedCount: unusedTables.length,
    usedTables,
    unusedTables,
    details: tableUsage,
    snippets: Object.fromEntries(tableDefinitions)
  }, null, 2));
}

main().catch(console.error);
