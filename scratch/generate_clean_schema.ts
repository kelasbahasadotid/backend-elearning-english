import fs from 'fs';
import readline from 'readline';

async function generateCleanSchema() {
  const report = JSON.parse(fs.readFileSync('scratch/table_audit_report.json', 'utf8'));
  const usedTables = new Set<string>(report.usedTables);
  const requiredFkTables = [
    'course_levels',
    'enrollment_sources',
    'notification_events',
    'notification_templates',
    'notification_channels',
    'assessment_difficulties',
    'question_types',
    'setting_groups'
  ];
  requiredFkTables.forEach(t => usedTables.add(t));

  console.log(`Generating clean schema for ${usedTables.size} active tables...`);

  // Read database.sql line by line and extract only the CREATE TABLE blocks and basic inserts/definitions for usedTables
  const rl = readline.createInterface({
    input: fs.createReadStream('database.sql', { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  let inTargetTable = false;
  let currentTableName = '';
  let cleanSql = `-- ==========================================================================\n`;
  cleanSql += `-- E-LEARNING ENGLISH LMS - CLEAN CONSOLIDATED DATABASE SCHEMA\n`;
  cleanSql += `-- Total Active Tables: ${usedTables.size}\n`;
  cleanSql += `-- Generated: ${new Date().toISOString()}\n`;
  cleanSql += `-- ==========================================================================\n\n`;
  cleanSql += `SET NAMES utf8mb4;\n`;
  cleanSql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  let tableBlocks: Map<string, string> = new Map();
  let currentBlock = '';

  for await (const line of rl) {
    const createMatch = line.match(/CREATE TABLE (?:IF NOT EXISTS )?[`]?([a-zA-Z0-9_]+)[`]?/i);
    if (createMatch) {
      const name = createMatch[1].toLowerCase();
      if (usedTables.has(name)) {
        inTargetTable = true;
        currentTableName = name;
        currentBlock = line + '\n';
      } else {
        inTargetTable = false;
      }
    } else if (inTargetTable) {
      currentBlock += line + '\n';
      if (line.includes(';')) {
        tableBlocks.set(currentTableName, currentBlock);
        inTargetTable = false;
        currentBlock = '';
      }
    }
  }

  // Sort tables logically
  for (const [table, block] of tableBlocks.entries()) {
    cleanSql += `-- -----------------------------------------------------\n`;
    cleanSql += `-- Table structure for: \`${table}\`\n`;
    cleanSql += `-- -----------------------------------------------------\n`;
    cleanSql += block + '\n\n';
  }

  cleanSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  fs.writeFileSync('database_schema_clean.sql', cleanSql, 'utf8');
  console.log(`✅ Saved clean database schema to database_schema_clean.sql (${tableBlocks.size} tables extracted)`);
}

generateCleanSchema().catch(console.error);
