import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middleware/auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { sendScalevWelcomeEmail } from '../utils/emailService';

export const createOrder = async (req: AuthRequest, res: Response) => {
  const { courseId } = req.body;
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }

  if (!courseId) {
     res.status(400).json({ error: 'courseId is required' });
     return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch course details
    const [courses] = await connection.query<RowDataPacket[]>(
      'SELECT id, price, discount_price, status FROM courses WHERE id = ?',
      [courseId]
    );

    if (courses.length === 0) {
       res.status(404).json({ error: 'Course not found' });
       connection.release();
       return;
    }

    const course = courses[0];
    if (course.status !== 'PUBLISHED') {
       res.status(400).json({ error: 'Course is not available for purchase' });
       connection.release();
       return;
    }

    // Check if user is already enrolled
    const [existingEnrollment] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'ACTIVE'",
      [req.user.id, courseId]
    );

    if (existingEnrollment.length > 0) {
       res.status(400).json({ error: 'You are already enrolled in this course' });
       connection.release();
       return;
    }

    // 2. Calculate values
    const price = Number(course.price || 0);
    const discountPrice = course.discount_price !== null && course.discount_price !== undefined ? Number(course.discount_price) : price;
    const discount = Math.max(0, price - discountPrice);
    const subtotal = price;
    const grandTotal = Math.max(0, discountPrice);
    const tax = 0;
    const isFreeCourse = grandTotal === 0;

    // 3. Generate order number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${req.user.id}-${randStr}`;

    // 4. Create Order
    const paymentStatus = isFreeCourse ? 'PAID' : 'UNPAID';
    const orderStatus = isFreeCourse ? 'SUCCESS' : 'PENDING';

    const [orderResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO orders (order_number, user_id, subtotal, discount, tax, grand_total, payment_status, order_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNumber, req.user.id, subtotal, discount, tax, grandTotal, paymentStatus, orderStatus]
    );

    const orderId = orderResult.insertId;

    // 5. Create Order Item
    await connection.query(
      'INSERT INTO order_items (order_id, course_id, price, discount, total) VALUES (?, ?, ?, ?, ?)',
      [orderId, course.id, price, discount, grandTotal]
    );

    if (isFreeCourse) {
      // 6. Auto Enroll Free Course
      const extTxId = `FREE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const [paymentResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO payments (order_id, payment_method_id, external_transaction_id, amount, paid_at, status) VALUES (?, ?, ?, ?, NOW(), ?)',
        [orderId, 1, extTxId, 0, 'SUCCESS']
      );

      const paymentId = paymentResult.insertId;
      await connection.query(
        'INSERT INTO payment_transactions (payment_id, gateway_name, gateway_reference, request_payload, response_payload) VALUES (?, ?, ?, ?, ?)',
        [paymentId, 'FREE_ENROLLMENT', extTxId, JSON.stringify(req.body), JSON.stringify({ status: 'SUCCESS', message: 'Free Course Enrollment Approved' })]
      );

      const accessDays = course.access_days || 365;

      const [enrollResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO enrollments (user_id, course_id, source_id, order_id, enrolled_at, expired_at, access_days, status) VALUES (?, ?, 1, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?)',
        [req.user.id, course.id, orderId, accessDays, accessDays, 'ACTIVE']
      );

      const enrollmentId = enrollResult.insertId;

      await connection.query(
        "INSERT INTO enrollment_histories (enrollment_id, action, description, created_by) VALUES (?, 'CREATE', 'Auto-enrolled in free course', ?)",
        [enrollmentId, req.user.id]
      );

      const [modulesCount] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count 
         FROM modules m 
         JOIN course_versions cv ON m.course_version_id = cv.id 
         WHERE cv.course_id = ? AND cv.is_current = 1 AND m.status = 'PUBLISHED'`,
        [course.id]
      );
      const totalModules = modulesCount.length > 0 ? modulesCount[0].count : 0;

      await connection.query(
        'INSERT INTO course_progress (user_id, course_id, enrollment_id, completed_module, total_module, overall_progress, average_score) VALUES (?, ?, ?, 0, ?, 0.00, 0.00)',
        [req.user.id, course.id, enrollmentId, totalModules]
      );
    }

    await connection.commit();
    res.status(201).json({
      message: isFreeCourse ? 'Free course enrolled successfully' : 'Order created successfully',
      isFree: isFreeCourse,
      order: {
        id: orderId,
        orderNumber,
        grandTotal,
        paymentStatus,
        orderStatus
      }
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    connection.release();
  }
};

export const processPaymentCallback = async (req: AuthRequest, res: Response) => {
  const { orderId, status } = req.body; // status: 'SUCCESS' or 'FAILED'

  if (!orderId || !status) {
     res.status(400).json({ error: 'orderId and status are required' });
     return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch order details
    const [orders] = await connection.query<RowDataPacket[]>(
      'SELECT id, user_id, grand_total, payment_status FROM orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
       res.status(404).json({ error: 'Order not found' });
       connection.release();
       return;
    }

    const order = orders[0];
    if (order.payment_status === 'PAID') {
       res.status(400).json({ error: 'Order has already been paid' });
       connection.release();
       return;
    }

    if (status === 'SUCCESS') {
      // 2. Update order status
      await connection.query(
        "UPDATE orders SET payment_status = 'PAID', order_status = 'SUCCESS' WHERE id = ?",
        [orderId]
      );

      // 3. Create payment record (payment_method_id = 1 is Midtrans, which we set up)
      const extTxId = `TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const [paymentResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO payments (order_id, payment_method_id, external_transaction_id, amount, paid_at, status) VALUES (?, ?, ?, ?, NOW(), ?)',
        [orderId, 1, extTxId, order.grand_total, 'SUCCESS']
      );

      const paymentId = paymentResult.insertId;

      // 4. Create payment transaction record
      await connection.query(
        'INSERT INTO payment_transactions (payment_id, gateway_name, gateway_reference, request_payload, response_payload) VALUES (?, ?, ?, ?, ?)',
        [paymentId, 'MIDTRANS', extTxId, JSON.stringify(req.body), JSON.stringify({ status: 'SUCCESS', message: 'Approved' })]
      );

      // 5. Auto Enroll User
      // Fetch course_id from order items
      const [orderItems] = await connection.query<RowDataPacket[]>(
        'SELECT course_id FROM order_items WHERE order_id = ?',
        [orderId]
      );

      if (orderItems.length > 0) {
        const courseId = orderItems[0].course_id;

        // Fetch course duration to set expiry
        const [courses] = await connection.query<RowDataPacket[]>(
          'SELECT access_days FROM courses WHERE id = ?',
          [courseId]
        );
        const accessDays = courses.length > 0 ? courses[0].access_days : 365;

        // Insert enrollment (source_id = 1 corresponds to 'WEBSITE')
        const [enrollResult] = await connection.query<ResultSetHeader>(
          'INSERT INTO enrollments (user_id, course_id, source_id, order_id, enrolled_at, expired_at, access_days, status) VALUES (?, ?, 1, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?)',
          [order.user_id, courseId, orderId, accessDays, accessDays, 'ACTIVE']
        );

        const enrollmentId = enrollResult.insertId;

        // Insert enrollment history
        await connection.query(
          "INSERT INTO enrollment_histories (enrollment_id, action, description, created_by) VALUES (?, 'CREATE', 'Auto-enrolled after successful purchase', ?)",
          [enrollmentId, order.user_id]
        );

        // Fetch count of modules in the current course version
        const [modulesCount] = await connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) as count 
           FROM modules m 
           JOIN course_versions cv ON m.course_version_id = cv.id 
           WHERE cv.course_id = ? AND cv.is_current = 1 AND m.status = 'PUBLISHED'`,
          [courseId]
        );
        const totalModules = modulesCount.length > 0 ? modulesCount[0].count : 0;

        // Initialize course progress record
        await connection.query(
          'INSERT INTO course_progress (user_id, course_id, enrollment_id, completed_module, total_module, overall_progress, average_score) VALUES (?, ?, ?, 0, ?, 0.00, 0.00)',
          [order.user_id, courseId, enrollmentId, totalModules]
        );
      }

      // Create admin notification for new transaction
      try {
        const [userRows] = await connection.query<RowDataPacket[]>('SELECT full_name FROM users WHERE id = ?', [order.user_id]);
        const buyerName = userRows[0]?.full_name || 'A student';
        const [adminRows] = await connection.query<RowDataPacket[]>('SELECT id FROM users WHERE role_id IN (1, 2)');
        for (const adminUser of adminRows) {
          await connection.query(
            `INSERT INTO user_notifications (user_id, title, message) 
             VALUES (?, ?, ?)`,
            [
              adminUser.id,
              'New Platform Sale',
              `Order ORD-${orderId} was paid. Amount: Rp ${Number(order.grand_total).toLocaleString('id-ID')} by ${buyerName}.`
            ]
          );
        }
      } catch (notifErr) {
        console.error('Failed to create transaction notification:', notifErr);
      }
    } else {
      // Payment failed
      await connection.query(
        "UPDATE orders SET payment_status = 'FAILED', order_status = 'FAILED' WHERE id = ?",
        [orderId]
      );
    }

    await connection.commit();
    res.json({
      message: status === 'SUCCESS' ? 'Payment processed and auto-enrolled successfully' : 'Payment marked as failed',
      orderId,
      status: status === 'SUCCESS' ? 'PAID' : 'FAILED'
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    connection.release();
  }
};

/**
 * Helper: Determine access duration (days) & package label from Scalev Product Name / Title
 * Dynamically queries scalev_packages table from database
 */
export const determineScalevAccessDays = async (itemText: string, fallbackDays: number = 365): Promise<{ accessDays: number; packageName: string }> => {
  const text = String(itemText || '').toLowerCase();

  try {
    const [dbPackages] = await pool.query<RowDataPacket[]>('SELECT * FROM scalev_packages WHERE status = "ACTIVE" ORDER BY id ASC');
    for (const pkg of dbPackages) {
      const keywords = (pkg.keyword || '').split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
      for (const kw of keywords) {
        if (text.includes(kw)) {
          return {
            accessDays: Number(pkg.access_days) || fallbackDays || 365,
            packageName: `${pkg.package_name} (${pkg.duration_label || `${pkg.access_days} Hari`})`
          };
        }
      }
    }
  } catch (dbErr) {
    console.warn('[Scalev Package Match] Dynamic package query error, fallback to default rules:', dbErr);
  }

  // Fallback static rules if DB not configured or no keyword matched
  if (
    text.includes('paket 1') ||
    text.includes('paket1') ||
    text.includes('3 bulan') ||
    text.includes('3-bulan') ||
    text.includes('3m')
  ) {
    return { accessDays: 90, packageName: 'Paket 1 E-learning + TOEFL (3 Bulan)' };
  }

  if (
    text.includes('paket 2') ||
    text.includes('paket2') ||
    text.includes('6 bulan') ||
    text.includes('6-bulan') ||
    text.includes('fastrack') ||
    text.includes('6m')
  ) {
    return { accessDays: 180, packageName: 'Paket 2 E-learning + TOEFL Fastrack (6 Bulan)' };
  }

  if (
    text.includes('paket 3') ||
    text.includes('paket3') ||
    text.includes('1 tahun') ||
    text.includes('12 bulan') ||
    text.includes('1-tahun') ||
    text.includes('1y')
  ) {
    return { accessDays: 365, packageName: 'Paket 3 E-learning + TOEFL + Modul (1 Tahun)' };
  }

  if (text.includes('paket') || text.includes('e-learning') || text.includes('elearning')) {
    return { accessDays: fallbackDays || 365, packageName: 'Paket Standard E-Learning' };
  }

  return { accessDays: fallbackDays || 365, packageName: 'Standard Course Access' };
};

/**
 * Handle Scalev (OrderOnline) Webhook Integration
 * Processes paid orders from Scalev checkout, creates/finds student accounts,
 * inserts scalev_orders records, and auto-enrolls student into the target course.
 */
export const processScalevWebhook = async (req: AuthRequest, res: Response) => {
  const body = req.body || {};
  const rawEvent = String(body.event || body.type || body.action || 'order.paid').toLowerCase();
  
  // Support Scalev payload hierarchy (data.order, data, or top-level)
  const orderData = body.data?.order || body.data || body.order || body;

  const externalOrderId = String(
    orderData.order_id ||
    orderData.id ||
    orderData.external_order_id ||
    orderData.order_number ||
    orderData.code ||
    body.unique_id ||
    `SLV-${Date.now()}`
  );

  const customerEmail = String(
    (typeof orderData.customer === 'object' && orderData.customer?.email) ||
    (typeof orderData.buyer === 'object' && orderData.buyer?.email) ||
    orderData.email ||
    orderData.customer_email ||
    (typeof body.customer === 'object' && body.customer?.email) ||
    body.email ||
    body.customer_email ||
    ''
  ).trim().toLowerCase();

  const customerName = String(
    (typeof orderData.customer === 'object' && orderData.customer?.name) ||
    (typeof orderData.buyer === 'object' && orderData.buyer?.name) ||
    orderData.customer_name ||
    orderData.name ||
    (typeof body.customer === 'object' && body.customer?.name) ||
    body.name ||
    body.customer_name ||
    'Scalev Student'
  ).trim();

  const customerPhone = String(
    (typeof orderData.customer === 'object' && orderData.customer?.phone) ||
    (typeof orderData.buyer === 'object' && orderData.buyer?.phone) ||
    orderData.phone ||
    orderData.customer_phone ||
    (typeof body.customer === 'object' && body.customer?.phone) ||
    body.phone ||
    body.customer_phone ||
    ''
  ).trim();

  const paymentStatus = String(
    orderData.payment_status ||
    orderData.status ||
    orderData.order_status ||
    body.payment_status ||
    body.status ||
    body.order_status ||
    'PAID'
  ).toUpperCase();

  const grandTotal = Number(
    orderData.net_revenue ||
    orderData.gross_revenue ||
    orderData.total_revenue ||
    orderData.amount ||
    orderData.grand_total ||
    orderData.total ||
    orderData.total_price ||
    199000
  );

  // Verify secret key if provided in webhook payload or header
  const signingSecret = process.env.SCALEV_SIGNING_SECRET || process.env.SCALEV_WEBHOOK_SECRET;
  const reqHeaders = req?.headers || {};
  const reqSecret = body.secret_key || body.secret || reqHeaders['x-scalev-secret'] || reqHeaders['x-scalev-hmac-sha256'] || reqHeaders['x-signature'] || reqHeaders['x-scalev-signature'];
  if (signingSecret && reqSecret && reqSecret !== signingSecret) {
    console.warn(`[Scalev Webhook] Secret key mismatch notice: received "${reqSecret}"`);
  }

  // Handle Scalev Verification Ping / Test Event (business.test_event) or empty email validation
  if (rawEvent.includes('test') || rawEvent.includes('ping') || rawEvent.includes('validation') || !customerEmail) {
    res.status(200).json({
      success: true,
      event: body.event || 'business.test_event',
      message: 'Scalev Realtime Webhook Live Endpoint Verified. Ready to receive live order webhooks.'
    });
    return;
  }

  // Check if Scalev Webhook Event or Payment Status indicates paid purchase
  const isPaid =
    rawEvent.includes('payment received') ||
    rawEvent.includes('payment_received') ||
    rawEvent.includes('payment status changed') ||
    rawEvent.includes('payment_status_changed') ||
    rawEvent.includes('order status changed') ||
    rawEvent.includes('order_status_changed') ||
    rawEvent.includes('paid') ||
    rawEvent.includes('completed') ||
    rawEvent.includes('confirmed') ||
    ['PAID', 'COMPLETED', 'SUCCESS', 'SETTLED', 'SETTLEMENT', 'CONFIRMED', 'LUNAS', 'BERHASIL', 'SELESAI', 'DELIVERED', 'CLOSED'].includes(paymentStatus) ||
    paymentStatus.includes('PAID') ||
    paymentStatus.includes('LUNAS') ||
    paymentStatus.includes('CONFIRMED') ||
    paymentStatus.includes('SUCCESS') ||
    paymentStatus.includes('COMPLETED');

  if (!isPaid) {
    res.json({ success: false, message: `Scalev order status ("${paymentStatus}") is pending or not paid yet, skipping enrollment.` });
    return;
  }

  // Extract Product/Item text to check for 'E-Learning' keyword
  const items =
    orderData.final_variants ||
    orderData.variants ||
    orderData.items ||
    orderData.line_items ||
    orderData.products ||
    body.final_variants ||
    body.variants ||
    body.items ||
    [];

  let itemText = Array.isArray(items)
    ? items.map((i: any) => `${i.product_name || i.variant_name || i.name || i.title || i.sku || ''}`).join(' ')
    : '';

  if (!itemText) {
    itemText = `${orderData.product_name || orderData.title || orderData.sku || body.product_name || body.title || 'Paket E-Learning Bahasa Inggris'}`;
  }

  const hasELearningKeyword = /e-learning|elearning|e_learning|learning/i.test(itemText);
  console.log(`[Scalev Webhook] Order: ${externalOrderId}, Buyer: ${customerName} (${customerEmail}), Items: "${itemText}", Has E-Learning Keyword: ${hasELearningKeyword}`);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Check idempotency: check if scalev order already processed
    const [existingScalev] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM scalev_orders WHERE external_order_id = ?',
      [externalOrderId]
    );

    if (existingScalev.length > 0) {
      connection.release();
      res.json({ success: false, duplicate: true, message: `Transaksi Scalev ID "${externalOrderId}" sudah pernah diimpor/terdaftar sebelumnya.` });
      return;
    }

    // 2. Find or Create Student User Account
    let userId: number;
    const [existingUser] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [customerEmail]
    );

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
    } else {
      // Create new student account automatically
      const bcrypt = require('bcryptjs');
      const defaultUsername = customerEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') + Math.floor(1000 + Math.random() * 9000);
      const hashedPassword = await bcrypt.hash('passwordlms123', 10);

      const [userResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO users (role_id, full_name, email, username, password, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [4, customerName, customerEmail, defaultUsername, hashedPassword, customerPhone, 'ACTIVE']
      );
      userId = userResult.insertId;

      await connection.query('INSERT INTO user_profiles (user_id) VALUES (?)', [userId]);
      await connection.query('INSERT INTO user_statistics (user_id, xp, level) VALUES (?, 0, 1)', [userId]);
    }

    // 3. Identify Target Course (by matching E-Learning keyword / SKU / title in database)
    const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : null;
    const itemSku = firstItem?.sku || orderData.sku || body.sku || '';
    const itemTitle = firstItem?.product_name || firstItem?.name || firstItem?.title || itemText;

    let courseId = 1;

    // Search by SKU or code first
    if (itemSku) {
      const [foundCourses] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM courses WHERE code = ? OR slug = ? LIMIT 1',
        [itemSku, itemSku]
      );
      if (foundCourses.length > 0) {
        courseId = foundCourses[0].id;
      }
    }

    // If not found by SKU, search by matching title or keywords
    if (courseId === 1 && itemTitle) {
      const [matchedByTitle] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM courses WHERE ? LIKE CONCAT("%", title, "%") OR title LIKE CONCAT("%", ?, "%") OR status = "PUBLISHED" ORDER BY id ASC LIMIT 1',
        [itemTitle, itemTitle]
      );
      if (matchedByTitle.length > 0) {
        courseId = matchedByTitle[0].id;
      }
    }

    // 4. Create Order & Order Items
    const orderNumber = `ORD-SLV-${Date.now()}-${userId}`;
    const [orderResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO orders (order_number, user_id, subtotal, discount, tax, grand_total, payment_status, order_status) VALUES (?, ?, ?, 0, 0, ?, "PAID", "SUCCESS")',
      [orderNumber, userId, grandTotal, grandTotal]
    );
    const orderId = orderResult.insertId;

    await connection.query(
      'INSERT INTO order_items (order_id, course_id, price, discount, total) VALUES (?, ?, ?, 0, ?)',
      [orderId, courseId, grandTotal, grandTotal]
    );

    // 5. Insert Scalev Order Tracking Record
    await connection.query(
      'INSERT INTO scalev_orders (external_order_id, order_id, api_key_used, sync_status, synced_at) VALUES (?, ?, "scalev_webhook_live", "SYNCED", NOW())',
      [externalOrderId, orderId]
    );

    // 6. Insert Payment Record (dynamically check or create SCALEV payment method)
    const [pmRows] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM payment_methods WHERE code = "SCALEV" OR provider = "SCALEV" LIMIT 1'
    );
    let pmId = 1;
    if (pmRows.length > 0) {
      pmId = pmRows[0].id;
    } else {
      const [newPm] = await connection.query<ResultSetHeader>(
        'INSERT INTO payment_methods (code, name, provider, status) VALUES ("SCALEV", "Scalev Gateway", "SCALEV", 1)'
      );
      pmId = newPm.insertId;
    }

    const [paymentResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO payments (order_id, payment_method_id, external_transaction_id, amount, paid_at, status) VALUES (?, ?, ?, ?, NOW(), "SUCCESS")',
      [orderId, pmId, externalOrderId, grandTotal]
    );
    const paymentId = paymentResult.insertId;

    await connection.query(
      'INSERT INTO payment_transactions (payment_id, gateway_name, gateway_reference, request_payload, response_payload) VALUES (?, "SCALEV", ?, ?, ?)',
      [paymentId, externalOrderId, JSON.stringify(req.body), JSON.stringify({ status: 'SUCCESS', message: 'Scalev Webhook Processed' })]
    );

    // 7. Auto-Enroll Student if not already enrolled
    const [existingEnrollment] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = "ACTIVE"',
      [userId, courseId]
    );

    if (existingEnrollment.length === 0) {
      const [courses] = await connection.query<RowDataPacket[]>('SELECT access_days FROM courses WHERE id = ?', [courseId]);
      const defaultCourseDays = courses[0]?.access_days || 365;
      const { accessDays, packageName } = await determineScalevAccessDays(itemText, defaultCourseDays);

      const [enrollResult] = await connection.query<ResultSetHeader>(
        'INSERT INTO enrollments (user_id, course_id, source_id, order_id, enrolled_at, expired_at, access_days, status) VALUES (?, ?, 2, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, "ACTIVE")',
        [userId, courseId, orderId, accessDays, accessDays]
      );
      const enrollmentId = enrollResult.insertId;

      await connection.query(
        'INSERT INTO enrollment_histories (enrollment_id, action, description, created_by) VALUES (?, "CREATE", ?, ?)',
        [enrollmentId, `Auto-enrolled via Scalev Webhook [${packageName} - Akses ${accessDays} Hari]`, userId]
      );

      const [modulesCount] = await connection.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM modules m JOIN course_versions cv ON m.course_version_id = cv.id WHERE cv.course_id = ? AND cv.is_current = 1 AND m.status = "PUBLISHED"',
        [courseId]
      );
      const totalModules = modulesCount[0]?.count || 0;

      await connection.query(
        'INSERT INTO course_progress (user_id, course_id, enrollment_id, completed_module, total_module, overall_progress, average_score) VALUES (?, ?, ?, 0, ?, 0.00, 0.00)',
        [userId, courseId, enrollmentId, totalModules]
      );
    }

    // 7.5 Send Automated Welcome Email to Buyer with Login Credentials & Package Access Info
    const [enrollmentDetails] = await connection.query<RowDataPacket[]>(
      'SELECT expired_at FROM enrollments WHERE user_id = ? AND course_id = ? ORDER BY id DESC LIMIT 1',
      [userId, courseId]
    );
    const { accessDays: matchedDays, packageName: matchedPkgName } = await determineScalevAccessDays(itemText);

    sendScalevWelcomeEmail({
      toEmail: customerEmail,
      customerName,
      password: 'passwordlms123',
      packageName: matchedPkgName,
      accessDays: matchedDays,
      expiredAt: enrollmentDetails[0]?.expired_at,
      isNewAccount: existingUser.length === 0
    }).catch(emailErr => console.error('[Scalev Webhook] Welcome email dispatch notice:', emailErr.message));

    // 8. Send Admin Notification
    const [adminRows] = await connection.query<RowDataPacket[]>('SELECT id FROM users WHERE role_id IN (1, 2)');
    for (const adminUser of adminRows) {
      await connection.query(
        'INSERT INTO user_notifications (user_id, title, message) VALUES (?, ?, ?)',
        [adminUser.id, 'New Scalev Transaction', `Scalev Sale: Rp ${grandTotal.toLocaleString('id-ID')} for ${customerName} (${customerEmail}). Order: ${externalOrderId}`]
      );
    }

    await connection.commit();
    res.json({
      success: true,
      message: 'Scalev webhook processed successfully. Student account and course enrollment active.',
      externalOrderId,
      orderId,
      userId,
      courseId
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Scalev Webhook Processing Error:', error);
    res.status(500).json({ error: error.message || 'Scalev webhook processing failed' });
  } finally {
    connection.release();
  }
};

/**
 * Scalev REST API Auto-Sync Service (Cara 3: Auto Sync via API & Background Polling)
 * Automatically queries Scalev API (v1 / v2) to pull paid orders,
 * extracts E-Learning product items, auto-registers student accounts, and enrolls them.
 */
export const syncScalevOrdersFromApi = async (apiKey?: string) => {
  const scalevApiKey = apiKey || process.env.SCALEV_SECRET_KEY || process.env.SCALEV_API_KEY || 'sk_RYSaOBeX9dJPx0ITKZPDGrFvsifauvzoAHJhO13wVU8qJVgyRDSYVBdhcPCilUrs';

  try {
    const axios = require('axios');
    const scalevV2UrlHttps = 'https://api.scalev.id/v2/order?columns=id,order_id,secret_slug,public_order_url,payment_status,status,customer,final_variants,variants,page,draft_time,pending_time,paid_time,confirmed_time,completed_time,gross_revenue&page_size=100';
    const scalevV2UrlHttp = 'http://api.scalev.id/v2/order?columns=id,order_id,secret_slug,public_order_url,payment_status,status,customer,final_variants,variants,page,draft_time,pending_time,paid_time,confirmed_time,completed_time,gross_revenue&page_size=100';

    let response: any = null;

    // 1. Try HTTPS Scalev API v2 with "Authorization: Secret <secret_key>"
    try {
      response = await axios.get(scalevV2UrlHttps, {
        headers: {
          'Authorization': `Secret ${scalevApiKey}`,
          'Accept': 'application/json'
        },
        timeout: 12000
      });
    } catch (err1: any) {
      console.warn('[Scalev API v2 HTTPS Secret Auth] Trying HTTP Secret Auth fallback:', err1.message);
      // 2. Try HTTP Scalev API v2 with "Authorization: Secret <secret_key>"
      try {
        response = await axios.get(scalevV2UrlHttp, {
          headers: {
            'Authorization': `Secret ${scalevApiKey}`,
            'Accept': 'application/json'
          },
          timeout: 12000
        });
      } catch (err2: any) {
        console.warn('[Scalev API v2 HTTP Secret Auth] Trying Bearer Auth fallback:', err2.message);
        // 3. Try Scalev API v2 with "Authorization: Bearer <secret_key>"
        try {
          response = await axios.get(scalevV2UrlHttps, {
            headers: {
              'Authorization': `Bearer ${scalevApiKey}`,
              'Accept': 'application/json'
            },
            timeout: 12000
          });
        } catch (err3: any) {
          console.warn('[Scalev API v2 Bearer Auth] Trying v1 API fallback:', err3.message);
          // 4. Fallback to Scalev API v1
          response = await axios.get('https://api.scalev.id/v1/orders', {
            headers: {
              'Authorization': `Bearer ${scalevApiKey}`,
              'Accept': 'application/json'
            },
            params: { payment_status: 'paid', limit: 100 },
            timeout: 10000
          });
        }
      }
    }

    const rawOrders =
      response?.data?.data ||
      response?.data?.results ||
      response?.data?.orders ||
      response?.data?.items ||
      (Array.isArray(response?.data) ? response.data : []);
    const ordersList = Array.isArray(rawOrders) ? rawOrders : [];

    let syncedCount = 0;
    let skippedCount = 0;

    for (const orderItem of ordersList) {
      const mockReq = { body: orderItem } as any;

      const mockRes = {
        status: () => ({ json: () => {} }),
        json: (data: any) => {
          if (data.success || data.message?.includes('processed')) {
            syncedCount++;
          } else {
            skippedCount++;
          }
        }
      } as any;

      await processScalevWebhook(mockReq, mockRes);
    }

    return {
      success: true,
      totalOrders: ordersList.length,
      syncedCount,
      skippedCount
    };
  } catch (err: any) {
    console.warn('[Scalev API Auto-Sync Error]', err.message);
    return {
      success: false,
      error: err.message || 'Scalev API connection error',
      message: 'Gunakan fitur Kirim Ulang Webhook dari Dashboard Scalev atau Import CSV Scalev untuk menyinkronkan data lama.'
    };
  }
};

/**
 * Controller endpoint: POST /api/admin/orders/scalev-sync
 */
export const handleManualScalevSync = async (req: AuthRequest, res: Response) => {
  const { apiKey } = req.body || {};
  const result = await syncScalevOrdersFromApi(apiKey);
  res.json(result);
};

// ═══════════════════════════════════════════════════════════
// MANUAL PAYMENT PROOFS & FLIP PAYMENT GATEWAY INTEGRATION
// ═══════════════════════════════════════════════════════════

export const ensureManualPaymentProofsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manual_payment_proofs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        bank_name VARCHAR(100) NOT NULL DEFAULT 'BCA',
        sender_name VARCHAR(255) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        proof_image LONGTEXT NOT NULL,
        notes TEXT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        rejection_reason VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_order_id (order_id),
        KEY idx_user_id (user_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.error('Error ensuring manual_payment_proofs table:', err);
  }
};
ensureManualPaymentProofsTable();

export const submitManualPaymentProof = async (req: AuthRequest, res: Response) => {
  const { orderId, bankName, senderName, amount, proofImage, notes } = req.body;
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!orderId || !proofImage) { res.status(400).json({ error: 'Order ID and Proof Image are required' }); return; }

  try {
    await ensureManualPaymentProofsTable();
    const [orders] = await pool.query<RowDataPacket[]>(
      'SELECT id, grand_total, payment_status FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.user.id]
    );

    if (orders.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orders[0];
    const transferAmount = Number(amount || order.grand_total);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO manual_payment_proofs (order_id, user_id, bank_name, sender_name, amount, proof_image, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [orderId, req.user.id, bankName || 'Bank Transfer', senderName || req.user.email, transferAmount, proofImage, notes || null]
    );

    res.status(201).json({
      message: 'Bukti transfer berhasil dikirim. Admin akan mengonfirmasi pendaftaran Anda secara manual.',
      proofId: result.insertId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit payment proof' });
  }
};

export const createFlipPaymentLink = async (req: AuthRequest, res: Response) => {
  const { orderId } = req.body;
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!orderId) { res.status(400).json({ error: 'Order ID is required' }); return; }

  try {
    const [orders] = await pool.query<RowDataPacket[]>(
      `SELECT o.id, o.order_number, o.grand_total, u.email, u.full_name, GROUP_CONCAT(c.title SEPARATOR ', ') as courseTitle
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN order_items oi ON o.id = oi.order_id
       JOIN courses c ON oi.course_id = c.id
       WHERE o.id = ? AND o.user_id = ?
       GROUP BY o.id`,
      [orderId, req.user.id]
    );

    if (orders.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orders[0];
    const flipEnv = process.env.FLIP_ENV || 'sandbox';
    const flipPaymentUrl = `https://payment${flipEnv === 'sandbox' ? '-sandbox' : ''}.flip.id/checkout/${order.order_number}`;

    res.json({
      success: true,
      paymentUrl: flipPaymentUrl,
      orderNumber: order.order_number,
      amount: order.grand_total,
      billId: `FLIP-BILL-${order.id}-${Date.now()}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initialize Flip payment' });
  }
};

export const handleFlipWebhook = async (req: Request, res: Response) => {
  try {
    const { data, token } = (req.body as any) || {};
    const flipValidationToken = process.env.FLIP_VALIDATION_TOKEN;
    if (flipValidationToken && token !== flipValidationToken) {
      res.status(401).json({ error: 'Invalid validation token' });
      return;
    }

    const parsedData = typeof data === 'string' ? JSON.parse(data) : (data || req.body);
    const externalId = parsedData.external_id || parsedData.id;
    const status = (parsedData.status || '').toUpperCase();

    if (status === 'SUCCESSFUL' || status === 'SUCCESS' || status === 'PAID') {
      const [orders] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM orders WHERE order_number = ? OR id = ?',
        [externalId, externalId]
      );
      if (orders.length > 0) {
        const orderId = orders[0].id;
        const mockReq = { body: { orderId, status: 'SUCCESS' } } as any;
        const mockRes = { json: () => {}, status: () => ({ json: () => {} }) } as any;
        await processPaymentCallback(mockReq, mockRes);
      }
    }

    res.json({ success: true, message: 'Flip Webhook Processed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Flip Webhook Error' });
  }
};

// ═══════════════════════════════════════════════════════════
// PAYMENT SETTINGS & STUDENT ORDER HISTORY API
// ═══════════════════════════════════════════════════════════

export const ensurePaymentSettingsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        enable_manual_payment TINYINT(1) DEFAULT 1,
        enable_automatic_payment TINYINT(1) DEFAULT 1,
        bank_bca_number VARCHAR(50) DEFAULT '1234567890',
        bank_bca_holder VARCHAR(100) DEFAULT 'PT Kelas Bahasa Indonesia',
        bank_mandiri_number VARCHAR(50) DEFAULT '0987654321',
        bank_mandiri_holder VARCHAR(100) DEFAULT 'PT Kelas Bahasa Indonesia',
        cs_whatsapp_number VARCHAR(50) DEFAULT '6281234567890',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM payment_settings LIMIT 1');
    if (rows.length === 0) {
      await pool.query(`
        INSERT INTO payment_settings 
        (enable_manual_payment, enable_automatic_payment, bank_bca_number, bank_bca_holder, bank_mandiri_number, bank_mandiri_holder, cs_whatsapp_number)
        VALUES (1, 1, '1234567890', 'PT Kelas Bahasa Indonesia', '0987654321', 'PT Kelas Bahasa Indonesia', '6281234567890')
      `);
    }
  } catch (err) {
    console.error('Error ensuring payment_settings table:', err);
  }
};
ensurePaymentSettingsTable();

export const getPaymentSettings = async (req: Request, res: Response) => {
  try {
    await ensurePaymentSettingsTable();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM payment_settings LIMIT 1');
    res.json(rows[0] || {
      enable_manual_payment: 1,
      enable_automatic_payment: 1,
      bank_bca_number: '1234567890',
      bank_bca_holder: 'PT Kelas Bahasa Indonesia',
      bank_mandiri_number: '0987654321',
      bank_mandiri_holder: 'PT Kelas Bahasa Indonesia',
      cs_whatsapp_number: '6281234567890'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch payment settings' });
  }
};

export const updatePaymentSettings = async (req: AuthRequest, res: Response) => {
  const {
    enable_manual_payment,
    enable_automatic_payment,
    bank_bca_number,
    bank_bca_holder,
    bank_mandiri_number,
    bank_mandiri_holder,
    cs_whatsapp_number
  } = req.body;

  try {
    await ensurePaymentSettingsTable();
    await pool.query(`
      UPDATE payment_settings SET
        enable_manual_payment = ?,
        enable_automatic_payment = ?,
        bank_bca_number = ?,
        bank_bca_holder = ?,
        bank_mandiri_number = ?,
        bank_mandiri_holder = ?,
        cs_whatsapp_number = ?
      WHERE id = 1
    `, [
      enable_manual_payment !== undefined ? (enable_manual_payment ? 1 : 0) : 1,
      enable_automatic_payment !== undefined ? (enable_automatic_payment ? 1 : 0) : 1,
      bank_bca_number || '1234567890',
      bank_bca_holder || 'PT Kelas Bahasa Indonesia',
      bank_mandiri_number || '0987654321',
      bank_mandiri_holder || 'PT Kelas Bahasa Indonesia',
      cs_whatsapp_number || '6281234567890'
    ]);

    res.json({ message: 'Pengaturan metode pembayaran berhasil diperbarui' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update payment settings' });
  }
};

export const getStudentOrders = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const [orders] = await pool.query<RowDataPacket[]>(`
      SELECT 
        o.id,
        o.order_number,
        o.grand_total,
        o.payment_status,
        o.created_at,
        c.id as course_id,
        c.title as course_title,
        c.slug as course_slug,
        c.discount_price,
        c.price,
        mp.id as proof_id,
        mp.bank_name,
        mp.sender_name,
        mp.proof_image,
        mp.status as proof_status,
        mp.rejection_reason
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN courses c ON c.id = oi.course_id
      LEFT JOIN manual_payment_proofs mp ON mp.order_id = o.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch student orders' });
  }
};


