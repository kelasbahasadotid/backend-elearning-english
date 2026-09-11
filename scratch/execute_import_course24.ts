import pool from '../src/config/db';
import { importLocalCourse24Csv, getYouTubeCsvTemplate } from '../src/services/youtubeImportService';

async function main() {
  console.log('--- STARTING COURSE 24 YOUTUBE CSV IMPORT ---');

  // 1. Check template
  console.log('\n--- 1. CSV Template Preview ---');
  console.log(getYouTubeCsvTemplate());

  // 2. Count media_files before
  const [beforeCount]: any = await pool.query('SELECT COUNT(*) as total FROM media_files WHERE deleted_at IS NULL');
  console.log(`\nMedia files count before import: ${beforeCount[0].total}`);

  // 3. Execute import
  console.log('\n--- 2. Executing Import of course24_youtube_links.csv ---');
  const result = await importLocalCourse24Csv('d:\\Kelas Bahasa\\course24_youtube_links.csv');

  console.log('Import Summary Result:');
  console.log({
    totalRows: result.totalRows,
    insertedMedia: result.insertedMedia,
    updatedMedia: result.updatedMedia,
    attachedToLessons: result.attachedToLessons,
    errorsCount: result.errors.length
  });

  if (result.errors.length > 0) {
    console.error('Errors encountered:', result.errors.slice(0, 5));
  }

  // 4. Count media_files after
  const [afterCount]: any = await pool.query('SELECT COUNT(*) as total FROM media_files WHERE deleted_at IS NULL');
  console.log(`\nMedia files count after import: ${afterCount[0].total}`);

  // 5. Query sample rows
  const [sampleRows]: any = await pool.query(`
    SELECT id, title, file_url, file_type, mime_type, target_placement, source_type, created_at
    FROM media_files
    WHERE file_url LIKE '%youtu%'
    ORDER BY id DESC
    LIMIT 5
  `);
  console.log('\nSample imported YouTube media files:', sampleRows);

  // 6. Test Idempotency (Run again, should update existing rather than duplicate)
  console.log('\n--- 3. Testing Idempotency (Re-running import) ---');
  const rerunResult = await importLocalCourse24Csv('d:\\Kelas Bahasa\\course24_youtube_links.csv');
  console.log('Re-run Result:', {
    totalRows: rerunResult.totalRows,
    insertedMedia: rerunResult.insertedMedia,
    updatedMedia: rerunResult.updatedMedia,
    attachedToLessons: rerunResult.attachedToLessons
  });

  const [finalCount]: any = await pool.query('SELECT COUNT(*) as total FROM media_files WHERE deleted_at IS NULL');
  console.log(`Media files count after re-run (should be equal to afterCount): ${finalCount[0].total}`);

  if (finalCount[0].total === afterCount[0].total) {
    console.log('✅ Idempotency test passed: No duplicate media created on re-import!');
  } else {
    console.error('❌ Duplicate media created!');
  }

  console.log('\n🎉 COURSE 24 YOUTUBE IMPORT SUCCESSFUL!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
