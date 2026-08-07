const axios = require('axios');
require('dotenv').config();

async function testNexusEndpoints() {
  const storeDomain = 'edudik.myscalev.com';
  const apiKey = process.env.SCALEV_CLIENT_ID || 'b42dd946-2fb5-43cd-b789-0fccfbeb7e6d';

  const paths = [
    '/api/v1/order',
    '/api/v1/orders',
    '/api/v1/store',
    '/api/v1/checkout',
    '/api/v1/public/order',
    '/api/v1/public/orders',
    '/api/v1/order/06FH5WZP63QYA1R1ECA7GGEP9G63QZY2SJYJM5QY',
    '/api/order/06FH5WZP63QYA1R1ECA7GGEP9G63QZY2SJYJM5QY'
  ];

  for (const path of paths) {
    const url = `https://${storeDomain}${path}`;
    try {
      console.log(`Testing: ${url}`);
      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 4000
      });
      console.log(`✅ Success (${url}): Status ${res.status}`);
      console.log(JSON.stringify(res.data).substring(0, 200));
    } catch (err) {
      console.log(`❌ ${path}: ${err.response?.status} - ${err.response?.data?.message || err.message}`);
    }
  }
}

testNexusEndpoints();
