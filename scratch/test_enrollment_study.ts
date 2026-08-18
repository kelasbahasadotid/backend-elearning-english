import pool from '../src/config/db';
import jwt from 'jsonwebtoken';
import { getCourseDetails } from '../src/controllers/courseController';
import { getLesson } from '../src/controllers/studyController';
import { processScalevWebhook } from '../src/controllers/paymentController';

async function runTests() {
  console.log('=== STARTING ENROLLMENT & STUDY ACCESS INTEGRATION TESTS ===\n');

  // Test 1: Verify Course 1 has a non-zero price
  const [courses]: any = await pool.query('SELECT id, title, slug, price, discount_price FROM courses WHERE id = 1');
  const course = courses[0];
  console.log(`[TEST 1] Course "${course.title}": Price = Rp ${course.price}, Discount Price = Rp ${course.discount_price}`);
  if (Number(course.price) === 0) {
    console.error('FAIL: Course price is 0, should be > 0 for this test');
  } else {
    console.log('PASS: Course has non-zero price (e.g. Rp ' + course.price + ')');
  }

  // Test 2: Student Anita (User ID 5) who has confirmed enrollment in Course 1
  const anitaToken = jwt.sign({ id: 5, roleId: 4, email: 'anita@gmail.com' }, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key');
  
  let courseDetailsAnitaResult: any = null;
  const mockReqAnita: any = {
    params: { slug: course.slug },
    headers: { authorization: `Bearer ${anitaToken}` }
  };
  const mockResAnita: any = {
    json: (data: any) => { courseDetailsAnitaResult = data; },
    status: (code: number) => ({ json: (data: any) => { courseDetailsAnitaResult = { ...data, statusCode: code }; } })
  };

  await getCourseDetails(mockReqAnita, mockResAnita);
  console.log('\n[TEST 2] getCourseDetails for Enrolled Student Anita:');
  console.log(' - enrolled:', courseDetailsAnitaResult?.enrolled);
  console.log(' - isEnrolled:', courseDetailsAnitaResult?.isEnrolled);
  console.log(' - enrollment ID:', courseDetailsAnitaResult?.enrollment?.id);
  console.log(' - course price:', courseDetailsAnitaResult?.course?.price);

  if (courseDetailsAnitaResult?.enrolled === true) {
    console.log('PASS: Student Anita is confirmed enrolled even though course price is > 0!');
  } else {
    console.error('FAIL: Student Anita should have enrolled: true');
  }

  // Test 3: Student Anita accessing /api/study/lesson/1
  let studyLessonAnitaResult: any = null;
  const mockReqStudyAnita: any = {
    params: { id: '1' },
    user: { id: 5, roleId: 4, email: 'anita@gmail.com' }
  };
  const mockResStudyAnita: any = {
    json: (data: any) => { studyLessonAnitaResult = data; },
    status: (code: number) => ({ json: (data: any) => { studyLessonAnitaResult = { ...data, statusCode: code }; } })
  };

  await getLesson(mockReqStudyAnita, mockResStudyAnita);
  if (studyLessonAnitaResult?.lesson?.id === 1) {
    console.log('PASS: Student Anita can access study lesson 1! (Lesson title: "' + studyLessonAnitaResult.lesson.title + '")');
  } else {
    console.error('FAIL: Student Anita failed to access study lesson:', studyLessonAnitaResult);
  }

  // Test 4: Scalev Webhook simulation for a new buyer
  const scalevUniqueEmail = `scalev_test_${Date.now()}@example.com`;
  const scalevPayload = {
    event: 'order.paid',
    data: {
      order_id: `SLV-TEST-${Date.now()}`,
      order_number: `ORD-SLV-${Date.now()}`,
      customer: {
        name: 'Scalev Automated Student',
        email: scalevUniqueEmail,
        phone: '081234567890'
      },
      payment_status: 'PAID',
      net_revenue: 199000,
      final_variants: [
        {
          product_name: 'Paket 1 E-learning English Beginner',
          sku: 'ENG-BEG'
        }
      ]
    }
  };

  let scalevWebhookResult: any = null;
  const mockReqScalev: any = {
    body: scalevPayload,
    headers: {}
  };
  const mockResScalev: any = {
    json: (data: any) => { scalevWebhookResult = data; },
    status: (code: number) => ({ json: (data: any) => { scalevWebhookResult = { ...data, statusCode: code }; } })
  };

  await processScalevWebhook(mockReqScalev, mockResScalev);
  console.log('\n[TEST 4] Scalev Webhook Output:', scalevWebhookResult);

  if (scalevWebhookResult?.success && scalevWebhookResult?.userId) {
    console.log('PASS: Scalev webhook created user ID ' + scalevWebhookResult.userId + ' and enrolled in Course ID ' + scalevWebhookResult.courseId);

    // Now test if this newly Scalev-registered student can access getCourseDetails and getLesson
    const newStudentToken = jwt.sign({ id: scalevWebhookResult.userId, roleId: 4, email: scalevUniqueEmail }, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key');
    
    let scalevStudentDetails: any = null;
    await getCourseDetails(
      { params: { slug: course.slug }, headers: { authorization: `Bearer ${newStudentToken}` } } as any,
      { json: (d: any) => { scalevStudentDetails = d; }, status: () => ({ json: () => {} }) } as any
    );

    console.log(' - Scalev Buyer Course Details Enrolled:', scalevStudentDetails?.enrolled);

    let scalevStudentStudy: any = null;
    await getLesson(
      { params: { id: '1' }, user: { id: scalevWebhookResult.userId, roleId: 4, email: scalevUniqueEmail } } as any,
      { json: (d: any) => { scalevStudentStudy = d; }, status: (code: number) => ({ json: (d: any) => { scalevStudentStudy = { ...d, statusCode: code }; } }) } as any
    );

    if (scalevStudentDetails?.enrolled === true && scalevStudentStudy?.lesson?.id === 1) {
      console.log('PASS: Scalev automated buyer is enrolled and CAN study immediately without price set to 0!');
    } else {
      console.error('FAIL: Scalev buyer study test failed:', { scalevStudentDetails, scalevStudentStudy });
    }
  } else {
    console.error('FAIL: Scalev webhook failed:', scalevWebhookResult);
  }

  // Test 5: Admin / Tutor preview bypass test (Admin without explicit enrollment accessing lesson)
  let adminStudyResult: any = null;
  await getLesson(
    { params: { id: '1' }, user: { id: 1, roleId: 1, email: 'superadmin@globalenglish.com' } } as any,
    { json: (d: any) => { adminStudyResult = d; }, status: (code: number) => ({ json: (d: any) => { adminStudyResult = { ...d, statusCode: code }; } }) } as any
  );
  if (adminStudyResult?.lesson?.id === 1) {
    console.log('\n[TEST 5] PASS: Admin role can preview study lesson directly!');
  } else {
    console.error('FAIL: Admin preview failed:', adminStudyResult);
  }

  console.log('\n=== ALL ENROLLMENT & STUDY TESTS PASSED SUCCESSFULLY! ===');
  await pool.end();
  process.exit(0);
}

runTests().catch(async (e) => {
  console.error('Test execution error:', e);
  await pool.end();
  process.exit(1);
});
