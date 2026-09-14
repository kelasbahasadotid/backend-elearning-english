const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 [1/3] Compiling TypeScript with "npm run build"...');
execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

const rootDir = path.join(__dirname, '..');
const zipName = 'backend-elearning-english.zip';
const zipPath = path.join(rootDir, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
  console.log(`🧹 Removed previous ${zipName}`);
}

console.log('📦 [2/3] Compressing production files into ZIP for hosting...');
const isWindows = process.platform === 'win32';

if (!isWindows) {
  // macOS / Linux native zip
  const cmd = `zip -r "${zipName}" dist app.js package.json package-lock.json .env.example uploads -x "uploads/recordings/*" "uploads/certificates/*" "uploads/tts_cache/*" "*.DS_Store" "*/.DS_Store"`;
  execSync(cmd, { stdio: 'inherit', cwd: rootDir });
} else {
  // Windows PowerShell native Compress-Archive
  const psCmd = `powershell -Command "Compress-Archive -Path dist, app.js, package.json, package-lock.json, .env.example, uploads -DestinationPath ${zipName} -Force"`;
  execSync(psCmd, { stdio: 'inherit', cwd: rootDir });
}

if (fs.existsSync(zipPath)) {
  const stats = fs.statSync(zipPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ [3/3] ZIP CREATED SUCCESSFULLY:`);
  console.log(`   File: ${zipName}`);
  console.log(`   Size: ${sizeMB} MB (${stats.size} bytes)`);
  console.log(`\n📌 Panduan Deploy Hosting / cPanel:`);
  console.log(`   1. Upload "${zipName}" ke File Manager hosting Anda.`);
  console.log(`   2. Extract file zip tersebut di folder root aplikasi.`);
  console.log(`   3. Buat/sesuaikan file .env di hosting.`);
  console.log(`   4. Jalankan "npm install --production" di hosting (tanpa perlu build lagi karena dist/ sudah siap pakai!).`);
  console.log(`   5. Restart Node.js App di cPanel / Hosting.`);
} else {
  console.error('❌ Failed to create zip file.');
  process.exit(1);
}
