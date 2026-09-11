import pool from '../src/config/db';
import { runChatMigration } from '../src/migrations/chat_setup';
import {
  getOrCreateStudentRoom,
  sendChatMessage,
  getStudentConversation,
  markChatAsRead,
  getAdminChatConversations
} from '../src/services/chatService';

async function main() {
  console.log('--- STARTING CHAT SERVICE & MIGRATION TEST ---');

  // 1. Run migration
  await runChatMigration();

  // 2. Find a student and an admin
  const [students]: any = await pool.query('SELECT id, full_name, email FROM users WHERE role_id = 4 LIMIT 1');
  const [admins]: any = await pool.query('SELECT id, full_name, email, role_id FROM users WHERE role_id IN (1, 2) LIMIT 1');

  const student = students[0];
  const admin = admins[0];

  console.log(`Student: ID ${student.id} (${student.full_name})`);
  console.log(`Admin: ID ${admin.id} (${admin.full_name})`);

  // 3. Test Student sending a message
  console.log('\n--- 1. Testing Student sending a message ---');
  const studentMsg = await sendChatMessage({
    studentId: student.id,
    senderId: student.id,
    senderRole: 'STUDENT',
    message: 'Halo Admin, saya ingin bertanya mengenai perpanjangan langganan kursus saya.'
  });
  console.log('Student Message Sent:', studentMsg.message);
  console.log('Room Status:', studentMsg.room);

  // 4. Test Admin fetching conversations list
  console.log('\n--- 2. Testing Admin fetching conversations list ---');
  const adminInbox = await getAdminChatConversations({ limit: 10 });
  console.log('Admin Inbox Summary:', adminInbox.summary);
  console.log('Admin Inbox Count:', adminInbox.conversations.length);
  const foundConv = adminInbox.conversations.find((c) => c.studentId === student.id);
  console.log('Found Student Conversation in Inbox:', foundConv);

  // 5. Test Admin replying to student
  console.log('\n--- 3. Testing Admin replying to student ---');
  const adminReply = await sendChatMessage({
    studentId: student.id,
    senderId: admin.id,
    senderRole: admin.role_id === 1 ? 'SUPERADMIN' : 'ADMIN',
    message: 'Halo! Tentu saja, Anda bisa memilih paket perpanjangan 30 hari atau 1 tahun melalui menu Langganan.'
  });
  console.log('Admin Reply Sent:', adminReply.message);
  console.log('Room Status After Reply:', adminReply.room);

  // 6. Test Student fetching message history
  console.log('\n--- 4. Testing Student fetching conversation history ---');
  const history = await getStudentConversation(student.id);
  console.log('Total Messages in Thread:', history.messages.length);
  console.log('Messages in Thread:', history.messages.map((m) => `[${m.senderRole}] ${m.senderName}: ${m.message}`));

  // 7. Test Student Mark As Read
  console.log('\n--- 5. Testing Student Mark As Read ---');
  const studentRead = await markChatAsRead({ studentId: student.id, readerRole: 'STUDENT' });
  console.log('Student Read Result:', studentRead);

  // 8. Test Admin Mark As Read
  console.log('\n--- 6. Testing Admin Mark As Read ---');
  const adminRead = await markChatAsRead({ studentId: student.id, readerRole: 'ADMIN' });
  console.log('Admin Read Result:', adminRead);

  // 9. Verify Room Counters are 0
  const roomAfter = await getOrCreateStudentRoom(student.id);
  console.log('Final Room Counters:', {
    unreadStudentCount: roomAfter.unreadStudentCount,
    unreadAdminCount: roomAfter.unreadAdminCount
  });

  console.log('\n✅ ALL CHAT SERVICE TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
