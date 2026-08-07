import pool from '../src/config/db';
import { processScalevWebhook } from '../src/controllers/paymentController';
import { ensureScalevPackagesTable } from '../src/controllers/adminController';

async function runSapaDevTest() {
  console.log('=== TESTING SCALEV WEBHOOK FOR sapadev10@gmail.com ===');

  await ensureScalevPackagesTable();

  const timestamp = Date.now();
  const testPayload = {
    event: 'order.payment_status_changed',
    unique_id: `EVT-SAPA-${timestamp}`,
    data: {
      order_id: `SLV-SAPA-${timestamp}`,
      payment_status: 'paid',
      order_status: 'confirmed',
      net_revenue: '299000',
      customer: {
        name: 'Sapa Dev Student',
        email: 'sapadev10@gmail.com',
        phone: '08123456789'
      },
      items: [
        {
          product_name: 'Paket 2 E-learning + toefl fastrack',
          price: '299000'
        }
      ]
    }
  };

  let responseData: any = null;
  let statusCode: number = 200;

  const mockReq = { body: testPayload, headers: {} } as any;
  const mockRes = {
    status: (code: number) => {
      statusCode = code;
      return {
        json: (data: any) => { responseData = data; }
      };
    },
    json: (data: any) => { responseData = data; }
  } as any;

  await processScalevWebhook(mockReq, mockRes);

  console.log(`HTTP Status: ${statusCode}`);
  console.log('Response JSON:', responseData);

  if (responseData?.success && responseData?.userId) {
    const [userRows]: any = await pool.query('SELECT * FROM users WHERE email = "sapadev10@gmail.com"');
    console.log('✅ Student User Account Created/Found in Database:');
    console.log(`   User ID: ${userRows[0]?.id}, Full Name: ${userRows[0]?.full_name}, Email: ${userRows[0]?.email}, Role ID: ${userRows[0]?.role_id}`);

    const [enrollRows]: any = await pool.query(
      'SELECT access_days, enrolled_at, expired_at FROM enrollments WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [responseData.userId]
    );
    console.log('✅ Active Course Enrollment Verified:');
    console.log(`   Access Days: ${enrollRows[0]?.access_days} Hari (Paket 2 Fastrack)`);
    console.log(`   Expiration Date: ${enrollRows[0]?.expired_at}`);
  }

  process.exit(0);
}

runSapaDevTest().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
