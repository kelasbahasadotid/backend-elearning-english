import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { getSampleQuizTemplateRows, createExcelTemplateBuffer, createCsvTemplateString } from '../src/utils/quizImportHelper';

const rootDir = 'd:/Kelas Bahasa';
const frontendPublicDir = path.join(rootDir, 'frontend-elearning-english/public/templates');
const backendTemplatesDir = path.join(rootDir, 'backend-elearning-english/templates');

// Ensure directories exist
if (!fs.existsSync(frontendPublicDir)) {
  fs.mkdirSync(frontendPublicDir, { recursive: true });
}
if (!fs.existsSync(backendTemplatesDir)) {
  fs.mkdirSync(backendTemplatesDir, { recursive: true });
}

const types = [
  { code: 'ALL', name: 'template_quiz_semua_tipe' },
  { code: 'MULTIPLE_CHOICE', name: 'template_quiz_multiple_choice' },
  { code: 'MULTIPLE_SELECT', name: 'template_quiz_multiple_select' },
  { code: 'TRUE_FALSE', name: 'template_quiz_true_false' },
  { code: 'FILL_BLANK', name: 'template_quiz_fill_blank' },
  { code: 'MATCHING', name: 'template_quiz_matching' },
  { code: 'WORD_ORDERING', name: 'template_quiz_word_ordering' },
];

const safeWrite = (filePath: string, data: any, encoding?: BufferEncoding) => {
  try {
    if (encoding) {
      fs.writeFileSync(filePath, data, encoding);
    } else {
      fs.writeFileSync(filePath, data);
    }
  } catch (err: any) {
    console.warn(`[SKIP LOCKED FILE] Could not write ${filePath}: ${err.message}`);
  }
};

for (const t of types) {
  const xlsxBuf = createExcelTemplateBuffer(t.code);
  const csvStr = createCsvTemplateString(t.code);

  safeWrite(path.join(frontendPublicDir, `${t.name}.xlsx`), xlsxBuf);
  safeWrite(path.join(frontendPublicDir, `${t.name}.csv`), '\uFEFF' + csvStr, 'utf-8');

  safeWrite(path.join(backendTemplatesDir, `${t.name}.xlsx`), xlsxBuf);
  safeWrite(path.join(backendTemplatesDir, `${t.name}.csv`), '\uFEFF' + csvStr, 'utf-8');
}

// Also write standard root template for immediate opening in file explorer
const masterXlsx = createExcelTemplateBuffer('ALL');
const masterCsv = createCsvTemplateString('ALL');
safeWrite(path.join(rootDir, 'TEMPLATE_IMPORT_QUIZ_MULTI_SHEET.xlsx'), masterXlsx);
safeWrite(path.join(rootDir, 'TEMPLATE_IMPORT_QUIZ_LENGKAP.xlsx'), masterXlsx);
safeWrite(path.join(rootDir, 'TEMPLATE_IMPORT_QUIZ_LENGKAP.csv'), '\uFEFF' + masterCsv, 'utf-8');

console.log('Successfully generated all template files in:');
console.log('1. Root Multi-Sheet:', path.join(rootDir, 'TEMPLATE_IMPORT_QUIZ_MULTI_SHEET.xlsx'));
console.log('1. Root:', path.join(rootDir, 'TEMPLATE_IMPORT_QUIZ_LENGKAP.xlsx'));
console.log('2. Frontend Public:', frontendPublicDir);
console.log('3. Backend Templates:', backendTemplatesDir);
