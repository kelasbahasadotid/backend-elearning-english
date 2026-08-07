const axios = require('axios');

async function testScalevValidationPing() {
  const webhookUrl = 'http://localhost:5000/api/payments/scalev-webhook';

  console.log('Testing Scalev Validation Ping (Empty Payload)...');
  try {
    const res = await axios.post(webhookUrl, {});
    console.log('✅ Response Status:', res.status);
    console.log('✅ Response Data:', res.data);
  } catch (err) {
    console.error('❌ Error testing validation ping:', err.response?.data || err.message);
  }
}

testScalevValidationPing();
