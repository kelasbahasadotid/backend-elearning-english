# Panduan API Notifikasi & Peringatan Masa Akses Kursus / Langganan (Backend)

Dokumentasi ini merinci sistem notifikasi otomatis dan endpoint API untuk menangani pengumuman ketika masa akses kursus atau langganan siswa akan segera berakhir (H-7, H-3, H-1, dan status Expired).

---

## 1. Arsitektur & Logika Sistem

Sistem ini memanfaatkan tabel database MySQL yang sudah ada tanpa perlu mengubah struktur tabel (*zero-breaking schema change*):
1. **`enrollments`**: Kolom `expired_at`, `status` (`ACTIVE`, `EXPIRED`), `user_id`, `course_id`.
2. **`user_notifications`**: Kolom `user_id`, `title`, `message`, `is_read`, `created_at`.

### Tahapan Peringatan (Milestone Warnings)
| Tahap | Kriteria Waktu | Urgency Level | Pesan / Judul Notifikasi |
|---|---|---|---|
| **H-7** | `daysLeft <= 7` & `> 3` | `INFO` | `[Pemberitahuan] Akses Kursus "{course_title}" Berakhir dalam 7 Hari` |
| **H-3** | `daysLeft <= 3` & `> 1` | `WARNING` | `[Pengingat] Akses Kursus "{course_title}" Berakhir dalam 3 Hari` |
| **H-1** | `daysLeft <= 1` & `> 0` | `CRITICAL` | `[Penting] Akses Kursus "{course_title}" Berakhir Besok!` |
| **Expired** | `expired_at <= NOW()` | `EXPIRED` | `[Masa Akses Berakhir] Akses Kursus "{course_title}" Telah Selesai` (Status enrollment diubah ke `'EXPIRED'`) |

### Mekanisme Anti-Spam (Deduplication)
Setiap notifikasi yang dikirim disematkan tag referensi unik di akhir pesan:
`[Ref: ENROLL-{enrollmentId}-H{milestone}]` (contoh: `[Ref: ENROLL-15-H3]`, `[Ref: ENROLL-15-HEXPIRED]`).
Scheduler otomatis mengecek apakah tag referensi ini sudah pernah dikirimkan ke `user_notifications`. Jika sudah ada, sistem tidak akan mengirim ulang duplikat.

### Background Scheduler
- Dijalankan secara otomatis saat server boot di `src/app.ts` via `initEnrollmentExpiryScheduler()`.
- Menjalankan pengecekan berkala setiap **1 jam** sekali.

---

## 2. Endpoint Student (Siswa)

### 2.1 Mengambil Kursus yang Mau Habis / Berakhir
- **Endpoint**: `GET /api/study/expiring-courses` (atau alias: `GET /api/students/expiring-courses`)
- **Header**: `Authorization: Bearer <token_student>`
- **Deskripsi**: Menampilkan daftar kursus siswa yang memiliki masa aktif, sisa hari (`daysLeft`), tingkat urgensi (`CRITICAL`, `WARNING`, `INFO`, `NORMAL`, `LIFETIME`, `EXPIRED`), serta rekomendasi pesan perpanjangan untuk banner dashboard siswa.

#### Response:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalEnrolled": 3,
      "expiringCount": 1,
      "expiredCount": 0,
      "hasCriticalWarning": false
    },
    "courses": [
      {
        "enrollmentId": 3,
        "courseId": 1,
        "courseTitle": "English Beginner Speaking",
        "courseSlug": "english-beginner-speaking",
        "thumbnail": "uploads/thumbnails/sample.jpg",
        "category": "General English",
        "enrolledAt": "2026-07-21T01:32:35.000Z",
        "expiredAt": "2026-09-13T12:30:53.000Z",
        "accessDays": 365,
        "status": "ACTIVE",
        "progressPercent": 60,
        "daysLeft": 2,
        "urgency": "WARNING",
        "isExpiring": true,
        "renewMessage": "Masa akses tersisa 2 hari lagi. Manfaatkan waktu Anda."
      },
      {
        "enrollmentId": 7,
        "courseId": 2,
        "courseTitle": "Advanced Business English",
        "courseSlug": "advanced-business-english",
        "thumbnail": null,
        "category": "Business",
        "enrolledAt": "2026-08-25T08:40:24.000Z",
        "expiredAt": "2027-08-25T08:40:24.000Z",
        "accessDays": 365,
        "status": "ACTIVE",
        "progressPercent": 20,
        "daysLeft": 348,
        "urgency": "NORMAL",
        "isExpiring": false,
        "renewMessage": "Masa akses aktif hingga 25 Agu 2027, 15.40 (348 hari lagi)."
      }
    ]
  }
}
```

### 2.2 Melihat Notifikasi Masuk Siswa
- **Endpoint**: `GET /api/student/notifications` atau `GET /api/notifications`
- **Header**: `Authorization: Bearer <token_student>`
- **Deskripsi**: Menampilkan riwayat notifikasi siswa (termasuk peringatan H-7, H-3, H-1, dan Expired).

---

## 3. Endpoint Admin (Manajemen & Monitoring)

### 3.1 Daftar Enrollment yang Akan Habis / Kedaluwarsa
- **Endpoint**: `GET /api/admin/enrollments/expiring`
- **Header**: `Authorization: Bearer <token_admin>`
- **Query Parameters**:
  - `daysThreshold` (opsional, default: `7`): Batas hari kedaluwarsa.
  - `page` (opsional, default: `1`): Nomor halaman.
  - `limit` (opsional, default: `20`): Jumlah data per halaman.
  - `search` (opsional): Mencari nama siswa, email, atau judul kursus.
  - `status` (opsional): `ACTIVE`, `EXPIRED`, atau `ALL`.

#### Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "userId": 4,
      "studentName": "Student Global English",
      "studentEmail": "student@globalenglish.com",
      "studentPhone": "08123456789",
      "courseId": 1,
      "courseTitle": "English Beginner Speaking",
      "courseCode": "ENG-BEG",
      "courseSlug": "english-beginner-speaking",
      "enrolledAt": "2026-07-21T01:32:35.000Z",
      "expiredAt": "2026-09-13T12:30:53.000Z",
      "accessDays": 365,
      "status": "ACTIVE",
      "progressPercent": 60,
      "daysLeft": 2,
      "urgency": "WARNING"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### 3.2 Trigger Pengecekan Manual & Dispatch Notifikasi
- **Endpoint**: `POST /api/admin/enrollments/check-expiries`
- **Header**: `Authorization: Bearer <token_admin>`
- **Deskripsi**: Menjalankan pengecekan kedaluwarsa secara manual melalui tombol admin dan langsung mengirim notifikasi bagi enrollment yang memenuhi syarat.

#### Response:
```json
{
  "success": true,
  "message": "Pemeriksaan kedaluwarsa kursus berhasil dijalankan",
  "data": {
    "totalChecked": 5,
    "notificationsSent": 2,
    "expiredUpdated": 1,
    "timestamp": "2026-09-11T12:31:15.199Z"
  }
}
```

---

## 4. Contoh Integrasi Frontend Banner Siswa (Rekomendasi UI)

```tsx
// Contoh komponen banner di Dashboard Siswa
const { data } = await fetch('/api/study/expiring-courses', { ... });

if (data?.summary?.hasCriticalWarning) {
  // Render Banner Merah (Urgent: H-1)
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-4">
      <p className="font-bold text-red-800">Perhatian: Akses Kursus Anda Berakhir Besok!</p>
      <p className="text-red-700 text-sm">Segera selesaikan materi belajar atau hubungi admin untuk perpanjangan.</p>
    </div>
  );
} else if (data?.summary?.expiringCount > 0) {
  // Render Banner Kuning / Oranye (Warning: H-3 atau H-7)
  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-4">
      <p className="font-bold text-amber-800">Pemberitahuan Masa Akses</p>
      <p className="text-amber-700 text-sm">Ada {data.summary.expiringCount} kursus yang masa aktifnya akan segera berakhir.</p>
    </div>
  );
}
```
