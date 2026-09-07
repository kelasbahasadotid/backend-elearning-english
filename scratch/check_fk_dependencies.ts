import fs from 'fs';

const report = JSON.parse(fs.readFileSync('scratch/table_audit_report.json', 'utf8'));
const usedTables: string[] = report.usedTables;
const unusedTables: string[] = report.unusedTables;

console.log(`Checking foreign key relationships...`);

// Let's parse all foreign key references in snippets of usedTables
const fkRegex = /FOREIGN KEY\s*\(`?([a-zA-Z0-9_]+)`?\)\s*REFERENCES\s*`?([a-zA-Z0-9_]+)`?\s*\(`?([a-zA-Z0-9_]+)`?\)/gi;

const missingReferencedTables = new Set<string>();

for (const table of usedTables) {
  const snippetObj = report.snippets[table];
  if (!snippetObj) continue;
  const snippet = snippetObj.sqlSnippet;
  let match;
  while ((match = fkRegex.exec(snippet)) !== null) {
    const col = match[1];
    const targetTable = match[2].toLowerCase();
    const targetCol = match[3];
    if (!usedTables.includes(targetTable)) {
      console.log(`⚠️ Used table "${table}" has foreign key (${col}) referencing "${targetTable}" which is marked as unused!`);
      missingReferencedTables.add(targetTable);
    }
  }
}

console.log('Missing referenced tables that must NOT be deleted:', Array.from(missingReferencedTables));
