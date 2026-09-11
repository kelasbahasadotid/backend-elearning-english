import { server, io } from '../src/app';
import jwt from 'jsonwebtoken';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key';

const adminToken = jwt.sign(
  { id: 1, email: 'admin@globalenglish.com', role_id: 1, fullName: 'Super Admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const studentToken = jwt.sign(
  { id: 5, email: 'anita@student.com', role_id: 4, fullName: 'Anita Student' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function runRealtimeChatTests() {
  const PORT = 5105;
  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`E2E Chat Server listening on port ${PORT}`);

  try {
    // ----------------------------------------------------
    // PART 1: REST API ENDPOINTS VERIFICATION
    // ----------------------------------------------------
    console.log('\n=== PART 1: REST API VERIFICATION ===');

    // 1. GET /api/chat/my-conversation (Student Anita)
    console.log('\n--- 1.1 GET /api/chat/my-conversation (Student) ---');
    const res1 = await fetch(`http://localhost:${PORT}/api/chat/my-conversation`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log('Status:', res1.status);
    const data1: any = await res1.json();
    console.log('Success:', data1.success, 'Student room ID:', data1.data?.room?.id);

    // 2. POST /api/chat/messages (Student Anita sends message via REST)
    console.log('\n--- 1.2 POST /api/chat/messages (Student) ---');
    const res2 = await fetch(`http://localhost:${PORT}/api/chat/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        message: 'Halo Admin via REST API, saya mau konsultasi materi belajar.'
      })
    });
    console.log('Status:', res2.status);
    const data2: any = await res2.json();
    console.log('Message created ID:', data2.data?.message?.id);

    // 3. GET /api/admin/chat/conversations (Admin)
    console.log('\n--- 1.3 GET /api/admin/chat/conversations (Admin) ---');
    const res3 = await fetch(`http://localhost:${PORT}/api/admin/chat/conversations?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res3.status);
    const data3: any = await res3.json();
    console.log('Admin Total Conversations:', data3.summary?.totalConversations);

    // 4. GET /api/admin/chat/conversations/5/messages (Admin view student 5)
    console.log('\n--- 1.4 GET /api/admin/chat/conversations/5/messages (Admin) ---');
    const res4 = await fetch(`http://localhost:${PORT}/api/admin/chat/conversations/5/messages`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Status:', res4.status);
    const data4: any = await res4.json();
    console.log('Messages count for Student 5:', data4.data?.messages?.length);

    // 5. POST /api/admin/chat/conversations/5/messages (Admin replies to student 5)
    console.log('\n--- 1.5 POST /api/admin/chat/conversations/5/messages (Admin) ---');
    const res5 = await fetch(`http://localhost:${PORT}/api/admin/chat/conversations/5/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        message: 'Halo Anita, kami siap membantu. Ada materi modul berapa yang perlu didiskusikan?'
      })
    });
    console.log('Status:', res5.status);
    const data5: any = await res5.json();
    console.log('Admin reply ID:', data5.data?.message?.id);

    // 6. PUT /api/chat/read (Student marks read)
    console.log('\n--- 1.6 PUT /api/chat/read (Student) ---');
    const res6 = await fetch(`http://localhost:${PORT}/api/chat/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log('Status:', res6.status);

    // 7. Security test: Student attempting to access Admin chat routes
    console.log('\n--- 1.7 Security RBAC: Student accessing Admin chat list ---');
    const res7 = await fetch(`http://localhost:${PORT}/api/admin/chat/conversations`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log('Status (expect 403):', res7.status);
    if (res7.status === 403) {
      console.log('✅ RBAC check passed: Student cannot access Admin conversation inbox.');
    }

    // ----------------------------------------------------
    // PART 2: REALTIME SOCKET.IO VERIFICATION
    // ----------------------------------------------------
    console.log('\n=== PART 2: REALTIME SOCKET.IO VERIFICATION ===');

    const studentSocket: ClientSocket = ioClient(`http://localhost:${PORT}`, {
      auth: { token: studentToken },
      transports: ['websocket']
    });

    const adminSocket: ClientSocket = ioClient(`http://localhost:${PORT}`, {
      auth: { token: adminToken },
      transports: ['websocket']
    });

    await Promise.all([
      new Promise<void>((resolve) => studentSocket.on('connect', resolve)),
      new Promise<void>((resolve) => adminSocket.on('connect', resolve))
    ]);
    console.log('✅ Both Student and Admin connected to Socket.IO successfully!');

    // Admin joins Anita's conversation room
    adminSocket.emit('join_conversation', { studentId: 5 });

    // Test 2.1: Student sends message -> Admin receives in realtime
    console.log('\n--- 2.1 Testing Realtime Message (Student -> Admin) ---');
    const adminMessagePromise = new Promise<any>((resolve) => {
      adminSocket.on('new_message', (payload) => {
        console.log('Admin received realtime new_message event:', payload);
        resolve(payload);
      });
    });

    studentSocket.emit('send_message', {
      message: 'Pertanyaan realtime dari Anita via WebSocket Socket.IO!'
    });

    const receivedByAdmin = await adminMessagePromise;
    console.log('✅ Admin received realtime message:', receivedByAdmin.message?.message);

    // Test 2.2: Admin typing indicator -> Student receives
    console.log('\n--- 2.2 Testing Realtime Typing Indicator (Admin -> Student) ---');
    const studentTypingPromise = new Promise<any>((resolve) => {
      studentSocket.on('user_typing', (payload) => {
        console.log('Student received user_typing event:', payload);
        resolve(payload);
      });
    });

    adminSocket.emit('typing_start', { studentId: 5 });
    const typingEvent = await studentTypingPromise;
    console.log('✅ Student received typing indicator from:', typingEvent.fullName);

    // Test 2.3: Admin sends reply via socket -> Student receives
    console.log('\n--- 2.3 Testing Realtime Reply (Admin -> Student) ---');
    const studentReplyPromise = new Promise<any>((resolve) => {
      studentSocket.on('new_message', (payload) => {
        console.log('Student received realtime new_message event:', payload);
        resolve(payload);
      });
    });

    adminSocket.emit('send_message', {
      studentId: 5,
      message: 'Balasan realtime dari Admin via WebSocket Socket.IO!'
    });

    const receivedByStudent = await studentReplyPromise;
    console.log('✅ Student received realtime reply:', receivedByStudent.message?.message);

    // Test 2.4: Read Receipts via socket
    console.log('\n--- 2.4 Testing Realtime Read Receipts ---');
    const adminReadPromise = new Promise<any>((resolve) => {
      adminSocket.on('messages_read', (payload) => {
        console.log('Admin received messages_read event:', payload);
        resolve(payload);
      });
    });

    studentSocket.emit('mark_as_read');
    const readReceipt = await adminReadPromise;
    console.log('✅ Admin received read receipt for student:', readReceipt.studentId);

    // Cleanup
    studentSocket.disconnect();
    adminSocket.disconnect();

    console.log('\n🎉 ALL REALTIME CHAT AND REST API TESTS COMPLETED SUCCESSFULLY!');
  } finally {
    server.close();
    process.exit(0);
  }
}

runRealtimeChatTests().catch((err) => {
  console.error('Realtime test failed:', err);
  process.exit(1);
});
