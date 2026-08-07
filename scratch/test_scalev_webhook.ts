import pool from '../src/config/db';
import { processScalevWebhook } from '../src/controllers/paymentController';
import { ensureScalevPackagesTable } from '../src/controllers/adminController';

async function runScalevWebhookTest() {
  console.log('--- STARTING SCALEV REALTIME WEBHOOK & ENROLLMENT TEST ---');

  // Ensure scalev_packages table initialized with default rules
  await ensureScalevPackagesTable();

  const timestamp = Date.now();
  const testCases = [
    {
      label: 'TEST PAKET 1 (3 Bulan / 90 Hari)',
      payload: {
        event: 'order.payment_status_changed',
        unique_id: `EVT-P1-${timestamp}`,
        data: {
          order_id: `SLV-P1-${timestamp}`,
          payment_status: 'paid',
          order_status: 'confirmed',
          net_revenue: '199000',
          customer: {
            name: 'Siswa Test Paket 1',
            email: `siswa.paket1.${timestamp}@example.com`,
            phone: '081234567891'
          },
          items: [
            {
              product_name: 'Paket 1 E-learning + toefl',
              price: '199000'
            }
          ]
        }
      },
      expectedDays: 90
    },
    {
      label: 'TEST PAKET 2 (6 Bulan / 180 Hari)',
      payload: {
        event: 'order.payment_status_changed',
        unique_id: `EVT-P2-${timestamp}`,
        data: {
          order_id: `SLV-P2-${timestamp}`,
          payment_status: 'paid',
          order_status: 'confirmed',
          net_revenue: '299000',
          customer: {
            name: 'Siswa Test Paket 2',
            email: `siswa.paket2.${timestamp}@example.com`,
            phone: '081234567892'
          },
          items: [
            {
              product_name: 'Paket 2 E-learning + toefl fastrack',
              price: '299000'
            }
          ]
        }
      },
      expectedDays: 180
    },
    {
      label: 'TEST PAKET 3 (1 Tahun / 365 Hari)',
      payload: {
        event: 'order.payment_status_changed',
        unique_id: `EVT-P3-${timestamp}`,
        data: {
          order_id: `SLV-P3-${timestamp}`,
          payment_status: 'paid',
          order_status: 'confirmed',
          net_revenue: '499000',
          customer: {
            name: 'Siswa Test Paket 3',
            email: `siswa.paket3.${timestamp}@example.com`,
            phone: '081234567893'
          },
          items: [
            {
              product_name: 'Paket 3 E-learning + toefl + modul',
              price: '499000'
            }
          ]
        }
      },
      expectedDays: 365
    }
  ];

  for (const tc of testCases) {
    console.log(`\n▶ Running ${tc.label}...`);
    let responseData: any = null;
    let statusCode: number = 200;

    const mockReq = { body: tc.payload, headers: {} } as any;
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

    console.log(`   Response Status: ${statusCode}`, responseData);

    if (responseData?.success && responseData?.userId && responseData?.courseId) {
      // Query database to verify actual inserted access_days & expired_at in enrollments
      const [enrollRows]: any = await pool.query(
        'SELECT access_days, enrolled_at, expired_at, DATEDIFF(expired_at, enrolled_at) as calculated_days FROM enrollments WHERE user_id = ? AND course_id = ? ORDER BY id DESC LIMIT 1',
        [responseData.userId, responseData.courseId]
      );

      if (enrollRows.length > 0) {
        const actualDays = enrollRows[0].access_days;
        console.log(`   ✅ DB Verification: Student User ID ${responseData.userId} Enrolled with access_days = ${actualDays} (Expected: ${tc.expectedDays} Hari)`);
        console.log(`   Expired At: ${enrollRows[0].expired_at}`);

        if (actualDays === tc.expectedDays) {
          console.log(`   🎉 SUCCESS: ${tc.label} PASSED PERFECTLY!`);
        } else {
          console.error(`   ❌ MISMATCH: Expected ${tc.expectedDays} days, but got ${actualDays} days.`);
        }
      }
    } else {
      console.error(`   ❌ ERROR: Webhook failed to process ${tc.label}:`, responseData);
    }
  }

  console.log('\n--- SCALEV WEBHOOK TEST FINISHED ---');
  process.exit(0);
}

runScalevWebhookTest().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
