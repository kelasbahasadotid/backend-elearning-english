# Panduan Integrasi Fitur Chat Realtime Siswa - Admin / SuperAdmin (Backend)

Backend ini menyediakan sistem obrolan langsung (*realtime live chat*) dua arah antara **Siswa** dan **Admin/Superadmin**. Sistem ini mendukung:
1. **WebSocket (Socket.IO)** untuk komunikasi instan tanpa delay (pesan realtime, typing indicator, read receipts).
2. **REST API Fallback** untuk fetching riwayat percakapan, pagination, ataupun fallback jika websocket tidak aktif.

---

## 1. Arsitektur Database

Tabel dibuat secara otomatis saat startup backend melalui [src/migrations/chat_setup.ts](file:///d:/Kelas%20Bahasa/backend-elearning-english/src/migrations/chat_setup.ts):

1. **`chat_rooms`**:
   - `id`: Primary Key
   - `student_id`: ID Siswa (Unik: 1 thread per akun siswa)
   - `last_message`: Potongan pesan terakhir
   - `last_message_at`: Waktu pesan terakhir
   - `last_sender_id`: ID pengirim terakhir
   - `unread_student_count`: Jumlah pesan belum dibaca oleh siswa
   - `unread_admin_count`: Jumlah pesan belum dibaca oleh admin
   - `status`: `'OPEN'` / `'CLOSED'`
2. **`chat_messages`**:
   - `id`: Primary Key
   - `room_id`: Foreign Key ke `chat_rooms.id`
   - `sender_id`: Foreign Key ke `users.id`
   - `sender_role`: `'STUDENT'`, `'ADMIN'`, `'SUPERADMIN'`
   - `message`: Isi pesan teks
   - `attachment_url`: URL lampiran gambar/file (opsional)
   - `is_read`: Boolean (1 jika sudah dibaca)
   - `read_at`: Waktu dibaca
   - `created_at`: Timestamp pesan

---

## 2. Realtime WebSocket (Socket.IO)

### 2.1 Menghubungkan Socket (Handshake Autentikasi)

Sertakan Token JWT siswa atau admin pada opsi `auth.token`:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: userToken // JWT Bearer token siswa atau admin
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Terhubung ke Socket.IO Realtime Chat!');
});
```

### 2.2 Room Channel Otomatis
- **Siswa**: Saat terhubung, socket siswa otomatis masuk ke room pribadinya: `chat:student_{studentId}`.
- **Admin**: Saat terhubung, socket admin otomatis masuk ke global channel: `chat:admins` (untuk menerima event inbox & unread badge counter).
- **Admin Membuka Percakapan Siswa**:
  ```typescript
  // Ketika admin mengklik nama siswa di dashboard
  socket.emit('join_conversation', { studentId: 5 });

  // Ketika admin menutup chat siswa tersebut
  socket.emit('leave_conversation', { studentId: 5 });
  ```

---

### 2.3 Socket.IO Events

#### A. Mengirim Pesan (`send_message`)
- **Dari Siswa**:
  ```typescript
  socket.emit('send_message', {
    message: 'Halo Admin, saya ingin bertanya materi Modul 2.',
    attachmentUrl: null // opsional
  }, (ack) => {
    if (ack.success) {
      console.log('Pesan terkirim:', ack.data.message);
    }
  });
  ```
- **Dari Admin ke Siswa**:
  ```typescript
  socket.emit('send_message', {
    studentId: 5, // ID siswa tujuan (wajib bagi admin)
    message: 'Halo, modul 2 dapat diakses di menu Kursus ya.',
    attachmentUrl: null
  }, (ack) => {
    console.log('Balasan terkirim:', ack);
  });
  ```

#### B. Menerima Pesan Realtime (`new_message`)
Didengarkan oleh Siswa maupun Admin yang sedang berada di room siswa tersebut:
```typescript
socket.on('new_message', (data: { studentId: number; message: ChatMessage }) => {
  console.log('Pesan baru diterima:', data.message);
  // Tambahkan data.message ke array state chat UI
});
```

Format Objek `message`:
```json
{
  "id": 12,
  "roomId": 1,
  "senderId": 4,
  "senderName": "Student Global English",
  "senderRole": "STUDENT",
  "senderAvatar": null,
  "message": "Halo Admin...",
  "attachmentUrl": null,
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-09-11T12:52:06.471Z"
}
```

#### C. Indikator Sedang Mengetik (`typing_start` / `typing_stop` & `user_typing`)
- **Mengirim status mengetik**:
  ```typescript
  // Saat user mulai mengetik di input:
  socket.emit('typing_start', { studentId: 5 }); // studentId wajib jika admin

  // Saat user berhenti mengetik / blur:
  socket.emit('typing_stop', { studentId: 5 });
  ```
- **Mendengarkan event lawan bicara mengetik**:
  ```typescript
  socket.on('user_typing', (data: { studentId: number; userId: number; fullName: string; isTyping: boolean }) => {
    if (data.isTyping) {
      console.log(`${data.fullName} sedang mengetik...`);
    } else {
      console.log(`${data.fullName} berhenti mengetik`);
    }
  });
  ```

#### D. Menandai Pesan Sudah Dibaca (`mark_as_read` & `messages_read`)
- **Mengirim tanda sudah dibaca**:
  ```typescript
  socket.emit('mark_as_read', { studentId: 5 }); // studentId wajib jika admin
  ```
- **Mendengarkan read receipts (centang dua biru)**:
  ```typescript
  socket.on('messages_read', (data: { studentId: number; readerId: number; readerRole: string }) => {
    console.log('Semua pesan telah dibaca oleh:', data.readerRole);
    // Update status pesan lokal menjadi isRead: true
  });
  ```

#### E. Update List Inbox Percakapan Admin (`conversation_updated`)
Didengarkan oleh Admin di halaman daftar chat:
```typescript
socket.on('conversation_updated', (data: { studentId: number; room: ChatRoomDetail; lastMessage: ChatMessage }) => {
  console.log('Ada pesan masuk baru, urutan chat teratas diupdate:', data);
  // Update state daftar percakapan di admin inbox
});
```

---

## 3. REST API Endpoints (HTTP Fallback)

### 3.1 Endpoint Siswa (Student)
Header: `Authorization: Bearer <token_siswa>`

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/chat/my-conversation` | Mengambil info room dan riwayat pesan akun siswa (Query: `limit=50`, `beforeId`). |
| `POST` | `/api/chat/messages` | Mengirim pesan ke admin (`{ message, attachmentUrl? }`). Otomatis memicu broadcast Socket.IO. |
| `PUT` | `/api/chat/read` | Menandai pesan masuk dari admin sebagai sudah dibaca. |

#### Contoh Response `GET /api/chat/my-conversation`:
```json
{
  "success": true,
  "data": {
    "room": {
      "id": 1,
      "studentId": 4,
      "studentName": "Student Global English",
      "studentEmail": "student@globalenglish.com",
      "studentAvatar": null,
      "lastMessage": "Halo Admin...",
      "lastMessageAt": "2026-09-11T12:52:06.000Z",
      "unreadStudentCount": 0,
      "unreadAdminCount": 1,
      "status": "OPEN"
    },
    "messages": [
      {
        "id": 1,
        "roomId": 1,
        "senderId": 4,
        "senderName": "Student Global English",
        "senderRole": "STUDENT",
        "message": "Halo Admin...",
        "isRead": true,
        "createdAt": "2026-09-11T12:51:41.000Z"
      }
    ]
  }
}
```

---

### 3.2 Endpoint Admin / SuperAdmin
Header: `Authorization: Bearer <token_admin>`

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/admin/chat/conversations` | Daftar percakapan seluruh siswa (Query: `search`, `status`, `page`, `limit`). Mengembalikan `summary.totalUnreadAdmin`. |
| `GET` | `/api/admin/chat/conversations/:studentId/messages` | Mengambil riwayat percakapan lengkap dengan siswa tertentu. |
| `POST` | `/api/admin/chat/conversations/:studentId/messages` | Mengirim balasan pesan dari admin ke siswa tertentu. Otomatis memicu broadcast Socket.IO. |
| `PUT` | `/api/admin/chat/conversations/:studentId/read` | Menandai pesan dari siswa sebagai sudah dibaca oleh admin. |

---

## 4. Contoh Komponen Frontend (React / Next.js)

```tsx
import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function StudentLiveChatWidget({ token }: { token: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 1. Fetch riwayat via REST API saat pertama kali buka
    fetch('http://localhost:5000/api/chat/my-conversation', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => {
        if (res.data?.messages) setMessages(res.data.messages);
      });

    // 2. Hubungkan Socket.IO
    const socket = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket']
    });
    socketRef.current = socket;

    // 3. Listener pesan baru
    socket.on('new_message', (data) => {
      setMessages((prev) => [...prev, data.message]);
      // Tandai sudah dibaca
      socket.emit('mark_as_read');
    });

    // 4. Listener typing indicator lawan bicara
    socket.on('user_typing', (data) => {
      setIsTyping(data.isTyping);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const handleSend = () => {
    if (!inputMessage.trim() || !socketRef.current) return;

    socketRef.current.emit('send_message', { message: inputMessage }, (ack: any) => {
      if (ack?.success) {
        setInputMessage('');
      }
    });
    socketRef.current.emit('typing_stop');
  };

  return (
    <div className="chat-container">
      <div className="messages-list">
        {messages.map((m) => (
          <div key={m.id} className={m.senderRole === 'STUDENT' ? 'my-message' : 'admin-message'}>
            <b>{m.senderName}: </b>
            <span>{m.message}</span>
          </div>
        ))}
        {isTyping && <p className="text-xs text-gray-500">Admin sedang mengetik...</p>}
      </div>

      <input
        type="text"
        value={inputMessage}
        onChange={(e) => {
          setInputMessage(e.target.value);
          socketRef.current?.emit('typing_start');
        }}
        onBlur={() => socketRef.current?.emit('typing_stop')}
        placeholder="Ketik pesan ke admin..."
      />
      <button onClick={handleSend}>Kirim</button>
    </div>
  );
}
```
