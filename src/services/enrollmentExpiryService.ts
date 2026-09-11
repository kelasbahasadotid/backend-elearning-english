import pool from '../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ExpiryCheckResult {
  totalChecked: number;
  notificationsSent: number;
  expiredUpdated: number;
  timestamp: string;
}

export interface StudentExpiringCourse {
  enrollmentId: number;
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  thumbnail: string | null;
  category: string | null;
  enrolledAt: string | null;
  expiredAt: string | null;
  accessDays: number | null;
  status: string;
  progressPercent: number;
  daysLeft: number | null;
  urgency: 'CRITICAL' | 'WARNING' | 'INFO' | 'EXPIRED' | 'NORMAL' | 'LIFETIME';
  isExpiring: boolean;
  renewMessage: string;
}

/**
 * Format Date to readable Indonesian string (e.g., "18 Sep 2026 23:59")
 */
function formatDateIndo(date: Date): string {
  try {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Check enrollments for expiration and dispatch user notifications
 * - H-7 notification
 * - H-3 notification
 * - H-1 notification
 * - EXPIRED status update + notification
 * Deduplication guarantees notifications are sent only once per milestone ref tag.
 */
export async function checkAndDispatchExpiryNotifications(): Promise<ExpiryCheckResult> {
  let notificationsSent = 0;
  let expiredUpdated = 0;
  let totalChecked = 0;

  try {
    // 1. Process ACTIVE enrollments that have passed their expiration date -> Mark as EXPIRED
    const [expiredEnrollments] = await pool.query<RowDataPacket[]>(
      `SELECT e.id, e.user_id, e.course_id, e.expired_at,
              c.title as course_title,
              u.full_name, u.email
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON e.user_id = u.id
       WHERE e.status = 'ACTIVE'
         AND e.expired_at IS NOT NULL
         AND e.expired_at <= NOW()`
    );

    for (const item of expiredEnrollments) {
      totalChecked++;
      // Update enrollment status to EXPIRED
      await pool.query<ResultSetHeader>(
        `UPDATE enrollments SET status = 'EXPIRED' WHERE id = ?`,
        [item.id]
      );
      expiredUpdated++;

      // Check deduplication tag in user_notifications
      const refTag = `[Ref: ENROLL-${item.id}-HEXPIRED]`;
      const [existingNotif] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM user_notifications WHERE user_id = ? AND message LIKE ? LIMIT 1`,
        [item.user_id, `%${refTag}%`]
      );

      if (existingNotif.length === 0) {
        const expiredDateStr = item.expired_at ? formatDateIndo(new Date(item.expired_at)) : 'hari ini';
        const title = `[Masa Akses Berakhir] Akses Kursus "${item.course_title}" Telah Selesai`;
        const message = `Halo ${item.full_name},\n\nMasa aktif akses kursus "${item.course_title}" Anda telah berakhir pada ${expiredDateStr}. Jika Anda ingin melanjutkan pembelajaran atau memperpanjang langganan, silakan hubungi admin atau daftar ulang melalui katalog kursus.\n\n${refTag}`;

        await pool.query(
          `INSERT INTO user_notifications (user_id, title, message, is_read, created_at) VALUES (?, ?, ?, 0, NOW())`,
          [item.user_id, title, message]
        );
        notificationsSent++;
      }
    }

    // 2. Process ACTIVE enrollments expiring within 7 days
    const [expiringEnrollments] = await pool.query<RowDataPacket[]>(
      `SELECT e.id, e.user_id, e.course_id, e.expired_at,
              c.title as course_title,
              u.full_name, u.email,
              TIMESTAMPDIFF(SECOND, NOW(), e.expired_at) as seconds_left
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON e.user_id = u.id
       WHERE e.status = 'ACTIVE'
         AND e.expired_at IS NOT NULL
         AND e.expired_at > NOW()
         AND e.expired_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)`
    );

    for (const item of expiringEnrollments) {
      totalChecked++;
      const secondsLeft = Number(item.seconds_left) || 0;
      const daysLeft = Math.ceil(secondsLeft / 86400);

      let milestone: '1' | '3' | '7' | null = null;
      if (daysLeft <= 1) {
        milestone = '1';
      } else if (daysLeft <= 3) {
        milestone = '3';
      } else if (daysLeft <= 7) {
        milestone = '7';
      }

      if (!milestone) continue;

      const refTag = `[Ref: ENROLL-${item.id}-H${milestone}]`;
      const [existingNotif] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM user_notifications WHERE user_id = ? AND message LIKE ? LIMIT 1`,
        [item.user_id, `%${refTag}%`]
      );

      if (existingNotif.length === 0) {
        const expiredDateStr = item.expired_at ? formatDateIndo(new Date(item.expired_at)) : 'segera';
        let title = '';
        let message = '';

        if (milestone === '1') {
          title = `[Penting] Akses Kursus "${item.course_title}" Berakhir Besok!`;
          message = `Halo ${item.full_name},\n\nPeringatan terakhir: Masa aktif akses kursus "${item.course_title}" Anda akan berakhir besok (${expiredDateStr}). Segera selesaikan materi, tugas, dan kuis Anda sebelum akses ditutup.\n\n${refTag}`;
        } else if (milestone === '3') {
          title = `[Pengingat] Akses Kursus "${item.course_title}" Berakhir dalam 3 Hari`;
          message = `Halo ${item.full_name},\n\nMasa aktif akses kursus "${item.course_title}" Anda tersisa 3 hari lagi (berakhir pada ${expiredDateStr}). Manfaatkan sisa waktu untuk menyelesaikan target belajar Anda.\n\n${refTag}`;
        } else {
          title = `[Pemberitahuan] Akses Kursus "${item.course_title}" Berakhir dalam 7 Hari`;
          message = `Halo ${item.full_name},\n\nMasa aktif akses kursus "${item.course_title}" Anda akan berakhir pada ${expiredDateStr} (7 hari lagi). Pastikan Anda terus aktif belajar agar materi dapat diselesaikan tepat waktu.\n\n${refTag}`;
        }

        await pool.query(
          `INSERT INTO user_notifications (user_id, title, message, is_read, created_at) VALUES (?, ?, ?, 0, NOW())`,
          [item.user_id, title, message]
        );
        notificationsSent++;
      }
    }

    return {
      totalChecked,
      notificationsSent,
      expiredUpdated,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[EnrollmentExpiryService] Error running expiry check:', error.message);
    throw error;
  }
}

/**
 * Get expiring/expired courses specifically for the logged-in student.
 * Used to render urgent warning banners and renewal CTA in student portal.
 */
export async function getStudentExpiringCourses(userId: number): Promise<{
  summary: {
    totalEnrolled: number;
    expiringCount: number;
    expiredCount: number;
    hasCriticalWarning: boolean;
  };
  courses: StudentExpiringCourse[];
}> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id as enrollment_id, e.course_id, e.enrolled_at, e.expired_at, e.access_days, e.status,
            c.title as course_title, c.slug as course_slug, c.thumbnail,
            cat.name as category,
            COALESCE(MAX(cp.overall_progress), 0) as progress_percent,
            TIMESTAMPDIFF(SECOND, NOW(), e.expired_at) as seconds_left
     FROM enrollments e
     JOIN courses c ON e.course_id = c.id
     LEFT JOIN course_categories cat ON c.category_id = cat.id
     LEFT JOIN course_progress cp ON (e.id = cp.enrollment_id OR (e.user_id = cp.user_id AND e.course_id = cp.course_id))
     WHERE e.user_id = ?
       AND (e.status = 'ACTIVE' OR (e.status = 'EXPIRED' AND e.expired_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)))
     GROUP BY e.id, e.course_id, e.enrolled_at, e.expired_at, e.access_days, e.status, c.title, c.slug, c.thumbnail, cat.name
     ORDER BY 
       CASE 
         WHEN e.status = 'ACTIVE' AND e.expired_at IS NOT NULL THEN e.expired_at
         WHEN e.status = 'EXPIRED' THEN '0000-00-00'
         ELSE '9999-12-31'
       END ASC`,
    [userId]
  );

  let expiringCount = 0;
  let expiredCount = 0;
  let hasCriticalWarning = false;

  const courses: StudentExpiringCourse[] = (rows as any[]).map((row) => {
    const status = String(row.status || 'ACTIVE').toUpperCase();
    const expiredAt = row.expired_at ? new Date(row.expired_at) : null;
    let daysLeft: number | null = null;
    let urgency: StudentExpiringCourse['urgency'] = 'NORMAL';
    let isExpiring = false;
    let renewMessage = 'Masa akses masih aktif.';

    if (!expiredAt) {
      urgency = 'LIFETIME';
      renewMessage = 'Akses seumur hidup (tanpa batas waktu).';
    } else {
      const secondsLeft = row.seconds_left !== null && row.seconds_left !== undefined ? Number(row.seconds_left) : null;
      if (secondsLeft !== null) {
        daysLeft = Math.ceil(secondsLeft / 86400);
      } else {
        daysLeft = Math.ceil((expiredAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      }

      if (status === 'EXPIRED' || daysLeft <= 0) {
        urgency = 'EXPIRED';
        isExpiring = true;
        daysLeft = 0;
        expiredCount++;
        renewMessage = 'Masa akses telah berakhir. Silakan lakukan perpanjangan langganan untuk melanjutkan.';
      } else if (daysLeft <= 1) {
        urgency = 'CRITICAL';
        isExpiring = true;
        expiringCount++;
        hasCriticalWarning = true;
        renewMessage = 'Masa akses berakhir besok! Segera selesaikan materi atau perpanjang akses.';
      } else if (daysLeft <= 3) {
        urgency = 'WARNING';
        isExpiring = true;
        expiringCount++;
        renewMessage = `Masa akses tersisa ${daysLeft} hari lagi. Manfaatkan waktu Anda.`;
      } else if (daysLeft <= 7) {
        urgency = 'INFO';
        isExpiring = true;
        expiringCount++;
        renewMessage = `Masa akses akan berakhir dalam ${daysLeft} hari.`;
      } else {
        urgency = 'NORMAL';
        renewMessage = `Masa akses aktif hingga ${formatDateIndo(expiredAt)} (${daysLeft} hari lagi).`;
      }
    }

    return {
      enrollmentId: row.enrollment_id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseSlug: row.course_slug,
      thumbnail: row.thumbnail,
      category: row.category,
      enrolledAt: row.enrolled_at ? new Date(row.enrolled_at).toISOString() : null,
      expiredAt: expiredAt ? expiredAt.toISOString() : null,
      accessDays: row.access_days,
      status,
      progressPercent: Math.round(Number(row.progress_percent) || 0),
      daysLeft,
      urgency,
      isExpiring,
      renewMessage
    };
  });

  return {
    summary: {
      totalEnrolled: courses.length,
      expiringCount,
      expiredCount,
      hasCriticalWarning
    },
    courses
  };
}

/**
 * Get expiring enrollments across the entire platform for Admin Monitoring.
 */
export async function getAdminExpiringEnrollments(options: {
  daysThreshold?: number;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
} = {}) {
  const daysThreshold = Number(options.daysThreshold) || 7;
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const offset = (page - 1) * limit;
  const search = options.search?.trim();
  const status = options.status?.trim()?.toUpperCase();

  let whereClause = `WHERE e.expired_at IS NOT NULL`;
  const params: any[] = [];

  if (status && status !== 'ALL') {
    whereClause += ` AND UPPER(e.status) = ?`;
    params.push(status);
  } else {
    // Default show ACTIVE within threshold OR EXPIRED recently (last 30 days)
    whereClause += ` AND (
      (e.status = 'ACTIVE' AND e.expired_at <= DATE_ADD(NOW(), INTERVAL ? DAY))
      OR (e.status = 'EXPIRED' AND e.expired_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
    )`;
    params.push(daysThreshold);
  }

  if (search) {
    whereClause += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR c.title LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  // Count total query
  const [countResult] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT e.id) as total
     FROM enrollments e
     JOIN users u ON e.user_id = u.id
     JOIN courses c ON e.course_id = c.id
     ${whereClause}`,
    params
  );
  const total = Number(countResult[0]?.total || 0);

  // Data query
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.user_id, e.course_id, e.enrolled_at, e.expired_at, e.access_days, e.status,
            u.full_name as student_name, u.email as student_email, u.phone as student_phone,
            c.title as course_title, c.code as course_code, c.slug as course_slug,
            COALESCE(MAX(cp.overall_progress), 0) as progress_percent,
            TIMESTAMPDIFF(SECOND, NOW(), e.expired_at) as seconds_left
     FROM enrollments e
     JOIN users u ON e.user_id = u.id
     JOIN courses c ON e.course_id = c.id
     LEFT JOIN course_progress cp ON (e.id = cp.enrollment_id OR (e.user_id = cp.user_id AND e.course_id = cp.course_id))
     ${whereClause}
     GROUP BY e.id, e.user_id, e.course_id, e.enrolled_at, e.expired_at, e.access_days, e.status, u.full_name, u.email, u.phone, c.title, c.code, c.slug
     ORDER BY e.expired_at ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const items = (rows as any[]).map((row) => {
    const expiredAt = row.expired_at ? new Date(row.expired_at) : null;
    const secondsLeft = row.seconds_left !== null ? Number(row.seconds_left) : null;
    const daysLeft = secondsLeft !== null ? Math.ceil(secondsLeft / 86400) : null;

    let urgency = 'NORMAL';
    if (row.status === 'EXPIRED' || (daysLeft !== null && daysLeft <= 0)) {
      urgency = 'EXPIRED';
    } else if (daysLeft !== null && daysLeft <= 1) {
      urgency = 'CRITICAL';
    } else if (daysLeft !== null && daysLeft <= 3) {
      urgency = 'WARNING';
    } else if (daysLeft !== null && daysLeft <= 7) {
      urgency = 'INFO';
    }

    return {
      id: row.id,
      userId: row.user_id,
      studentName: row.student_name,
      studentEmail: row.student_email,
      studentPhone: row.student_phone,
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseCode: row.course_code,
      courseSlug: row.course_slug,
      enrolledAt: row.enrolled_at,
      expiredAt: row.expired_at,
      accessDays: row.access_days,
      status: row.status,
      progressPercent: Math.round(Number(row.progress_percent) || 0),
      daysLeft,
      urgency
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Background scheduler initialized on app startup
 */
let expirySchedulerInterval: NodeJS.Timeout | null = null;

export function initEnrollmentExpiryScheduler() {
  if (expirySchedulerInterval) {
    clearInterval(expirySchedulerInterval);
  }

  // Run immediate check on server boot
  checkAndDispatchExpiryNotifications()
    .then((res) => {
      console.log(`[EnrollmentExpiryService] Initial expiry check done. Checked: ${res.totalChecked}, Notifs Sent: ${res.notificationsSent}, Expired Updated: ${res.expiredUpdated}`);
    })
    .catch((err) => {
      console.error('[EnrollmentExpiryService] Initial check error:', err.message);
    });

  // Run periodic check every 1 hour (3,600,000 ms)
  const INTERVAL_MS = 60 * 60 * 1000;
  expirySchedulerInterval = setInterval(() => {
    checkAndDispatchExpiryNotifications().catch((err) => {
      console.error('[EnrollmentExpiryService] Periodic check error:', err.message);
    });
  }, INTERVAL_MS);

  console.log('[EnrollmentExpiryService] Enrollment expiration notification scheduler initialized (interval: 1 hour).');
}
