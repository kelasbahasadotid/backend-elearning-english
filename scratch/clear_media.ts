import pool from '../src/config/db';

async function clearMedia() {
  const connection = await pool.getConnection();
  try {
    const [before]: any = await connection.query('SELECT COUNT(*) as count FROM media_files');
    console.log(`📊 Sebelum: ${before[0].count} records`);

    await connection.query('DELETE FROM media_files');
    await connection.query('ALTER TABLE media_files AUTO_INCREMENT = 1');

    const [after]: any = await connection.query('SELECT COUNT(*) as count FROM media_files');
    console.log(`✅ Sesudah: ${after[0].count} records — tabel media_files kosong bersih.`);
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  } finally {
    connection.release();
    await pool.end();
    process.exit(0);
  }
}

clearMedia();
