const http = require('http');

const PORT = 5000;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => raw += c);
        res.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(raw); } catch (e) {}
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function verify() {
  console.log('--- VERIFYING REVIEWS AND ANNOUNCEMENTS API ---');

  // 1. Authenticate student
  console.log('Authenticating student...');
  const studentAuth = await request('POST', '/api/auth/login', {
    email: 'student@globalenglish.com',
    password: 'Student123'
  });
  if (studentAuth.status !== 200) {
    throw new Error('Student login failed: ' + JSON.stringify(studentAuth.body));
  }
  const studentToken = studentAuth.body.token;

  // 2. Authenticate admin
  console.log('Authenticating admin...');
  const adminAuth = await request('POST', '/api/auth/login', {
    email: 'admin@globalenglish.com',
    password: 'Admin123'
  });
  if (adminAuth.status !== 200) {
    throw new Error('Admin login failed: ' + JSON.stringify(adminAuth.body));
  }
  const adminToken = adminAuth.body.token;

  // 3. Post student review for course 1
  console.log('Submitting review as student...');
  const reviewRes = await request('POST', '/api/courses/1/reviews', {
    rating: 4.5,
    review_text: 'Excellent structured grammar explanations! Real vocal checks are super helpful.'
  }, studentToken);
  console.log('Review response:', reviewRes.status, reviewRes.body);
  if (reviewRes.status !== 200) {
    throw new Error('Failed to post review');
  }

  // 4. Fetch details to get review id
  console.log('Fetching course details...');
  const detailRes = await request('GET', '/api/courses/english-beginner-speaking', null, studentToken);
  const reviewsList = detailRes.body.reviews || [];
  console.log('Reviews count:', reviewsList.length);
  const review = reviewsList.find(r => r.reviewer_name === 'Student Global English');
  if (!review) {
    throw new Error('Student review not found in details response');
  }
  console.log('Found review ID:', review.id);

  // 5. Reply to review as admin
  console.log('Submitting reply as admin...');
  const replyRes = await request('POST', `/api/courses/reviews/${review.id}/reply`, {
    reply_text: 'Thank you for your feedback! We are thrilled to help you master speaking.'
  }, adminToken);
  console.log('Reply response:', replyRes.status, replyRes.body);
  if (replyRes.status !== 200) {
    throw new Error('Failed to post admin reply');
  }

  // 6. Post announcement as admin
  console.log('Submitting announcement as admin...');
  const annRes = await request('POST', '/api/courses/1/announcements', {
    title: 'Quiz 1 Open Now',
    content: 'Tenses assessment is now live. Complete it to earn 30 XP.'
  }, adminToken);
  console.log('Announcement response:', annRes.status, annRes.body);
  if (annRes.status !== 200) {
    throw new Error('Failed to post announcement');
  }

  // 7. Verify all are fetched correctly on course detail
  console.log('Verifying course details contains reply and announcement...');
  const finalRes = await request('GET', '/api/courses/english-beginner-speaking', null, studentToken);
  const finalReviews = finalRes.body.reviews || [];
  const finalAnns = finalRes.body.announcements || [];

  const verifiedReview = finalReviews.find(r => r.id === review.id);
  console.log('Verified Review:', verifiedReview);
  if (!verifiedReview || verifiedReview.reply_text !== 'Thank you for your feedback! We are thrilled to help you master speaking.') {
    throw new Error('Verification failed: Admin reply not saved correctly or not joined in getCourseDetails');
  }

  const verifiedAnn = finalAnns.find(a => a.title === 'Quiz 1 Open Now');
  console.log('Verified Announcement:', verifiedAnn);
  if (!verifiedAnn || verifiedAnn.content !== 'Tenses assessment is now live. Complete it to earn 30 XP.') {
    throw new Error('Verification failed: Announcement not saved correctly or not retrieved');
  }

  console.log('ALL API TESTS PASSED SUCCESSFULLY!');
}

verify().catch((err) => {
  console.error('VERIFICATION FAILED:', err.message);
  process.exit(1);
});
