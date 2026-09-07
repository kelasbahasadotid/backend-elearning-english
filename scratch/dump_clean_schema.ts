import * as fs from 'fs';
import * as path from 'path';
import pool from '../src/config/db';

async function exportCleanSchema() {
  const [tablesResult]: any = await pool.query('SHOW TABLES');
  const tables = tablesResult.map((r: any) => Object.values(r)[0]);
  console.log(`Exporting clean schema for ${tables.length} tables...`);

  let sqlOutput = `-- ========================================================\n`;
  sqlOutput += `-- E-LEARNING ENGLISH LMS CLEAN DATABASE SCHEMA\n`;
  sqlOutput += `-- Total Active Tables: ${tables.length}\n`;
  sqlOutput += `-- Generated: ${new Date().toISOString()}\n`;
  sqlOutput += `-- ========================================================\n\n`;
  sqlOutput += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  for (const table of tables) {
    const [createTableResult]: any = await pool.query(`SHOW CREATE TABLE \`${table}\``);
    const createSql = createTableResult[0]['Create Table'];
    sqlOutput += `-- Table structure for \`${table}\`\n`;
    sqlOutput += `DROP TABLE IF EXISTS \`${table}\`;\n`;
    sqlOutput += `${createSql};\n\n`;
  }

  sqlOutput += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  const outputPath = path.resolve(__dirname, '../database_schema_clean.sql');
  fs.writeFileSync(outputPath, sqlOutput, 'utf8');
  console.log(`Clean schema successfully exported to ${outputPath}`);
  process.exit(0);
}

exportCleanSchema().catch(e => {
  console.error(e);
  process.exit(1);
});
