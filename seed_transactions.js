const mysql = require('mysql2/promise');

async function seed() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'elearning_language'
  });

  console.log('Clearing existing mock orders and enrollments...');
  
  // We keep order IDs 1, 2, 3 just in case they are tied to local files/tests.
  // We delete orders with IDs > 3.
  await pool.query('DELETE FROM scalev_orders WHERE order_id > 3');
  await pool.query('DELETE FROM order_items WHERE order_id > 3');
  await pool.query('DELETE FROM enrollments WHERE order_id > 3');
  await pool.query('DELETE FROM orders WHERE id > 3');

  const studentIds = [4, 5, 7, 8];
  const courseIds = [1, 2];
  const coursePrices = { 1: 250000, 2: 250000 };

  // Helper to get random item
  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Helper to format date
  const formatDate = (year, month, day, hour, min, sec) => {
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  console.log('Generating realistic monthly transactions (March - August 2026)...');

  // Multi-month transaction configurations
  // [month, scalev_count, website_count]
  const monthlyConfigs = [
    [3, 6, 3],  // March
    [4, 9, 5],  // April
    [5, 7, 4],  // May
    [6, 12, 6], // June
    [7, 8, 5],  // July (excluding the 3 existing ones)
    [8, 16, 10] // August
  ];

  let orderIdCounter = 4;

  for (const [month, scalevCount, websiteCount] of monthlyConfigs) {
    const year = 2026;

    // 1. Generate Scalev Orders (Source: SCALEV, id: 2)
    for (let i = 0; i < scalevCount; i++) {
      const userId = randomItem(studentIds);
      const courseId = randomItem(courseIds);
      const price = coursePrices[courseId];
      const grandTotal = price;
      
      const day = Math.floor(Math.random() * 28) + 1;
      const createdStr = formatDate(year, month, day, 10, i * 4, 30);
      const orderNum = `ORD-SCALEV-${year}${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${i}`;

      // Insert Order
      await pool.query(
        `INSERT INTO orders (id, order_number, user_id, subtotal, discount, tax, grand_total, payment_status, order_status, created_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, 'PAID', 'SUCCESS', ?)`,
        [orderIdCounter, orderNum, userId, price, grandTotal, createdStr]
      );

      // Insert Order Item
      await pool.query(
        `INSERT INTO order_items (order_id, course_id, price, discount, total)
         VALUES (?, ?, ?, 0, ?)`,
        [orderIdCounter, courseId, price, grandTotal]
      );

      // Insert Scalev Link
      const scalevExtId = `sc_ext_${orderIdCounter}`;
      await pool.query(
        `INSERT INTO scalev_orders (external_order_id, order_id, api_key_used, sync_status, synced_at)
         VALUES (?, ?, 'scalev_live_api_key_xyz', 'SYNCED', ?)`,
        [scalevExtId, orderIdCounter, createdStr]
      );

      // Insert Enrollment (using INSERT IGNORE to skip duplicates safely)
      const enrolledAt = createdStr;
      const expiredAt = formatDate(year + 1, month, day, 10, i * 4, 30); // 1 year access
      await pool.query(
        `INSERT IGNORE INTO enrollments (user_id, course_id, source_id, order_id, enrolled_at, expired_at, status)
         VALUES (?, ?, 2, ?, ?, ?, 'ACTIVE')`,
        [userId, courseId, orderIdCounter, enrolledAt, expiredAt]
      );

      orderIdCounter++;
    }

    // 2. Generate Website Direct Orders (Source: WEBSITE, id: 1)
    for (let i = 0; i < websiteCount; i++) {
      const userId = randomItem(studentIds);
      const courseId = randomItem(courseIds);
      const price = coursePrices[courseId];
      const grandTotal = price;
      
      const day = Math.floor(Math.random() * 28) + 1;
      const createdStr = formatDate(year, month, day, 14, i * 4, 45);
      const orderNum = `ORD-WEB-${year}${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${i}`;

      // Insert Order
      await pool.query(
        `INSERT INTO orders (id, order_number, user_id, subtotal, discount, tax, grand_total, payment_status, order_status, created_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, 'PAID', 'SUCCESS', ?)`,
        [orderIdCounter, orderNum, userId, price, grandTotal, createdStr]
      );

      // Insert Order Item
      await pool.query(
        `INSERT INTO order_items (order_id, course_id, price, discount, total)
         VALUES (?, ?, ?, 0, ?)`,
        [orderIdCounter, courseId, price, grandTotal]
      );

      // Insert Enrollment (using INSERT IGNORE)
      const enrolledAt = createdStr;
      const expiredAt = formatDate(year + 1, month, day, 14, i * 4, 45);
      await pool.query(
        `INSERT IGNORE INTO enrollments (user_id, course_id, source_id, order_id, enrolled_at, expired_at, status)
         VALUES (?, ?, 1, ?, ?, ?, 'ACTIVE')`,
        [userId, courseId, orderIdCounter, enrolledAt, expiredAt]
      );

      orderIdCounter++;
    }
  }

  console.log(`Successfully seeded ${orderIdCounter - 4} realistic transactions!`);
  await pool.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
