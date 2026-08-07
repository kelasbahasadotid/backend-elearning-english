const http = require('http');

const PORT = 5000;

function postJSON(urlPath, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
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

async function runTests() {
  console.log('--- STARTING CONTENT MANAGER ROLE SECURITY AUDIT ---');
  try {
    // 1. Authenticate content manager
    console.log('1. Attempting login as Content Manager...');
    const loginRes = await postJSON('/api/auth/login', {
      email: 'contentmanager@globalenglish.com',
      password: 'ContentManager123'
    });

    if (loginRes.status !== 200 || !loginRes.body.token) {
      console.error('FAILED: Content Manager login returned code:', loginRes.status, loginRes.body);
      process.exit(1);
    }
    const token = loginRes.body.token;
    console.log('SUCCESS: Content Manager authenticated.');

    // 2. Fetch categories (should be allowed: role 5)
    console.log('2. Trying to fetch categories list (should be allowed)...');
    const categoriesRes = await getJSON('/api/admin/categories', token);
    if (categoriesRes.status !== 200) {
      console.error('FAILED: Fetching categories was denied for Content Manager:', categoriesRes.status, categoriesRes.body);
      process.exit(1);
    }
    console.log('SUCCESS: Categories fetched successfully.');

    // 3. Try to access user directory (should be forbidden: role 5)
    console.log('3. Trying to access admin user directory (should be forbidden)...');
    const usersRes = await getJSON('/api/admin/users', token);
    if (usersRes.status === 403) {
      console.log('SUCCESS: Access was correctly denied (403 Forbidden).');
    } else {
      console.error('FAILED: Access was NOT denied! Status code returned:', usersRes.status, usersRes.body);
      process.exit(1);
    }

    console.log('--- CONTENT MANAGER SECURITY AUDIT PASSED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (err) {
    console.error('CRITICAL ERROR running security audit:', err.message);
    process.exit(1);
  }
}

runTests();
