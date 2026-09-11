import { Request, Response } from 'express';
import {
  checkAndDispatchExpiryNotifications,
  getStudentExpiringCourses,
  getAdminExpiringEnrollments
} from '../services/enrollmentExpiryService';

/**
 * GET /api/study/expiring-courses or GET /api/students/expiring-courses
 * Returns expiring/expired courses with urgency flags for the authenticated student.
 */
export async function getMyExpiringCourses(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const data = await getStudentExpiringCourses(Number(userId));
    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('[EnrollmentExpiryController] Error getting student expiring courses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expiring courses',
      message: error.message
    });
  }
}

/**
 * GET /api/admin/enrollments/expiring
 * List expiring enrollments across the system for Admin monitoring.
 */
export async function getExpiringEnrollmentsAdmin(req: Request, res: Response): Promise<void> {
  try {
    const { daysThreshold, page, limit, search, status } = req.query;

    const result = await getAdminExpiringEnrollments({
      daysThreshold: daysThreshold ? Number(daysThreshold) : 7,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined
    });

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination
    });
  } catch (error: any) {
    console.error('[EnrollmentExpiryController] Error getting admin expiring enrollments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin expiring enrollments',
      message: error.message
    });
  }
}

/**
 * POST /api/admin/enrollments/check-expiries
 * Manually trigger expiration check and send notifications.
 */
export async function triggerManualExpiryCheck(req: Request, res: Response): Promise<void> {
  try {
    const result = await checkAndDispatchExpiryNotifications();
    res.status(200).json({
      success: true,
      message: 'Pemeriksaan kedaluwarsa kursus berhasil dijalankan',
      data: result
    });
  } catch (error: any) {
    console.error('[EnrollmentExpiryController] Error triggering manual expiry check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger expiry check',
      message: error.message
    });
  }
}
