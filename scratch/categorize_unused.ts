import fs from 'fs';

const report = JSON.parse(fs.readFileSync('scratch/table_audit_report.json', 'utf8'));
const usedTables = new Set<string>(report.usedTables);
const requiredFkTables = [
  'course_levels',
  'enrollment_sources',
  'notification_events',
  'notification_templates',
  'assessment_difficulties',
  'question_types',
  'setting_groups'
];

requiredFkTables.forEach(t => usedTables.add(t));

const candidateUnused = report.unusedTables.filter((t: string) => !usedTables.has(t));

console.log(`Total candidate tables for cleanup: ${candidateUnused.length}`);

// Check if any candidate table has incoming FKs from other tables or if it has any outgoing FKs
const fkIncoming: Record<string, string[]> = {};
const fkOutgoing: Record<string, string[]> = {};

const fkRegex = /FOREIGN KEY\s*\(`?([a-zA-Z0-9_]+)`?\)\s*REFERENCES\s*`?([a-zA-Z0-9_]+)`?\s*\(`?([a-zA-Z0-9_]+)`?\)/gi;

for (const [table, info] of Object.entries(report.snippets as Record<string, any>)) {
  const snippet = info.sqlSnippet;
  let match;
  while ((match = fkRegex.exec(snippet)) !== null) {
    const target = match[2].toLowerCase();
    if (!fkIncoming[target]) fkIncoming[target] = [];
    fkIncoming[target].push(table);

    if (!fkOutgoing[table]) fkOutgoing[table] = [];
    fkOutgoing[table].push(target);
  }
}

// Group candidates:
// 1. Completely isolated (no incoming FK, no outgoing FK)
// 2. Dead clusters (e.g. ai_requests -> ai_providers, where whole cluster is unused)
// 3. Dependent on active tables (e.g. banner_click_logs -> banners)

const isolated: string[] = [];
const deadClusters: string[] = [];
const dependentOnActive: string[] = [];

for (const table of candidateUnused) {
  const incomingFromActive = (fkIncoming[table] || []).filter(src => usedTables.has(src));
  if (incomingFromActive.length > 0) {
    console.log(`⚠️ Unused table ${table} is referenced by ACTIVE table: ${incomingFromActive.join(', ')}`);
  }

  const outgoing = fkOutgoing[table] || [];
  const incoming = fkIncoming[table] || [];

  if (outgoing.length === 0 && incoming.length === 0) {
    isolated.push(table);
  } else if (outgoing.some(dst => usedTables.has(dst))) {
    dependentOnActive.push(table);
  } else {
    deadClusters.push(table);
  }
}

console.log('\n--- BREAKDOWN OF UNUSED TABLES ---');
console.log(`1. Completely Isolated (No FKs): ${isolated.length} tables`);
console.log(`2. Dead Subsystem Clusters (e.g. AI logs, analytics, gamification): ${deadClusters.length} tables`);
console.log(`3. Dependent on Active tables (Unused children like logs/history): ${dependentOnActive.length} tables`);

fs.writeFileSync('scratch/unused_breakdown.json', JSON.stringify({
  totalCandidates: candidateUnused.length,
  isolated,
  deadClusters,
  dependentOnActive,
  allCandidates: candidateUnused
}, null, 2));

console.log('\nSample isolated tables:', isolated.slice(0, 10));
console.log('Sample dead clusters:', deadClusters.slice(0, 10));
console.log('Sample dependent on active:', dependentOnActive.slice(0, 10));
