const http = require('http');
const fs = require('fs');
const path = require('path');

// Port definition
const PORT = 5000;

function postJSON(urlPath, data, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: 'POST',
      headers: headers
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

function getJSON(urlPath, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.end();
  });
}

// Multipart/form-data POST helper
function postMultipart(urlPath, fields, filePath, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + Math.random().toString(36).substring(2);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    };

    let bodyBuffers = [];

    // Append fields
    for (const [key, val] of Object.entries(fields)) {
      bodyBuffers.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
    }

    // Append file
    const filename = path.basename(filePath);
    bodyBuffers.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`));
    bodyBuffers.push(fs.readFileSync(filePath));
    bodyBuffers.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const totalLength = bodyBuffers.reduce((acc, buf) => acc + buf.length, 0);
    headers['Content-Length'] = totalLength;

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: 'POST',
      headers: headers
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', (e) => reject(e));
    
    // Write buffers
    for (const buf of bodyBuffers) {
      req.write(buf);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING RUNTIME API TEST VERIFICATION ---');
  try {
    // 1. Authenticate student
    console.log('1. Attempting login as student...');
    const loginRes = await postJSON('/api/auth/login', {
      email: 'student@globalenglish.com',
      password: 'Student123'
    });

    if (loginRes.status !== 200 || !loginRes.body.token) {
      console.error('FAILED: Login request returned code:', loginRes.status, loginRes.body);
      process.exit(1);
    }
    const token = loginRes.body.token;
    console.log('SUCCESS: Authenticated. Token received.');

    // 2. Fetch prompts for speaking test 1
    console.log('2. Fetching speaking prompts for Test ID 1...');
    const promptsRes = await getJSON('/api/speaking/test/1/prompts', token);
    if (promptsRes.status !== 200) {
      console.error('FAILED: Get prompts request returned code:', promptsRes.status, promptsRes.body);
      process.exit(1);
    }
    console.log('SUCCESS: Prompts fetched:', promptsRes.body);

    // 3. Submit a speaking attempt
    console.log('3. Submitting speech recording attempt...');
    
    // Create temporary dummy file to upload
    const dummyFilePath = path.join(__dirname, 'dummy_audio.webm');
    fs.writeFileSync(dummyFilePath, 'dummy webm binary representation data');

    const submitFields = {
      promptId: '1',
      speakingTestId: '1',
      durationSeconds: '12'
    };

    const submitRes = await postMultipart('/api/speaking/submit', submitFields, dummyFilePath, token);
    
    // Clean temporary file
    fs.unlinkSync(dummyFilePath);

    if (submitRes.status !== 201) {
      console.error('FAILED: Submit speech attempt returned code:', submitRes.status, submitRes.body);
      process.exit(1);
    }
    console.log('SUCCESS: Speech attempt analyzed and stored.');

    // 4. Test Bookmarking a Lesson
    console.log('4. Testing bookmarking Lesson 1...');
    // We need to enroll the student in course 1 first ( Anita is already enrolled, but student [user 4] needs active enrollment or bypass)
    // Wait, let's toggle bookmark for lesson 1.
    const bookmarkRes1 = await postJSON('/api/study/lesson/1/bookmark', {}, token);
    if (bookmarkRes1.status !== 200) {
      console.error('FAILED: Bookmark toggle failed with status:', bookmarkRes1.status, bookmarkRes1.body);
      process.exit(1);
    }
    console.log('SUCCESS: Toggle response:', bookmarkRes1.body);

    // 5. Retrieve Bookmarks
    console.log('5. Retrieving user bookmarks list...');
    const bookmarksList1 = await getJSON('/api/study/bookmarks', token);
    if (bookmarksList1.status !== 200 || !Array.isArray(bookmarksList1.body)) {
      console.error('FAILED: Failed to retrieve bookmarks:', bookmarksList1.status, bookmarksList1.body);
      process.exit(1);
    }
    console.log('SUCCESS: Bookmarks found:', bookmarksList1.body.length);

    // 6. Toggle Bookmark off
    console.log('6. Toggling bookmark off for Lesson 1...');
    const bookmarkRes2 = await postJSON('/api/study/lesson/1/bookmark', {}, token);
    if (bookmarkRes2.status !== 200 || bookmarkRes2.body.bookmarked !== false) {
      console.error('FAILED: Failed to remove bookmark:', bookmarkRes2.status, bookmarkRes2.body);
      process.exit(1);
    }
    console.log('SUCCESS: Toggle response (removed):', bookmarkRes2.body);

    console.log('--- ALL INTEGRATION VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (err) {
    console.error('CRITICAL ERROR running endpoint tests:', err.message);
    process.exit(1);
  }
}

runTests();
