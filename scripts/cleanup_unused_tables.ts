import pool from '../src/config/db';
import fs from 'fs';

const tablesToDrop = [
  'achievement_categories',
  'achievement_rules',
  'achievements',
  'ai_models',
  'ai_prompt_templates',
  'ai_prompt_versions',
  'ai_provider_credentials',
  'ai_providers',
  'ai_request_logs',
  'ai_requests',
  'ai_response_cache',
  'analytics_daily',
  'analytics_events',
  'analytics_monthly',
  'analytics_settings',
  'analytics_snapshots',
  'analytics_weekly',
  'api_access_tokens',
  'api_clients',
  'assessment_analytics',
  'assessment_rules',
  'assessment_settings',
  'backup_histories',
  'banner_click_logs',
  'blogs',
  'broadcast_recipients',
  'broadcasts',
  'certificate_downloads',
  'certificate_languages',
  'certificate_logs',
  'certificate_qrcodes',
  'certificate_recipients',
  'certificate_revisions',
  'certificate_rules',
  'certificate_settings',
  'certificate_share_logs',
  'certificate_signatures',
  'certificate_template_fields',
  'certificate_verifications',
  'challenge_tasks',
  'coupon_codes',
  'coupon_usages',
  'course_analytics',
  'course_localizations',
  'course_prerequisites',
  'course_tag_relations',
  'daily_challenges',
  'dashboard_layouts',
  'dashboard_widgets',
  'discounts',
  'email_logs',
  'executive_reports',
  'feature_flags',
  'gamification_settings',
  'integration_api_logs',
  'integration_credentials',
  'integration_event_logs',
  'integration_events',
  'integration_job_logs',
  'integration_jobs',
  'integration_providers',
  'integration_queue',
  'integration_webhook_logs',
  'integration_webhooks',
  'invoice_items',
  'invoices',
  'job_executions',
  'leaderboard_entries',
  'leaderboards',
  'learning_activities',
  'learning_sessions',
  'learning_streak_rewards',
  'learning_streaks',
  'lesson_analytics',
  'lesson_assets',
  'lesson_audio',
  'lesson_downloads',
  'lesson_external_links',
  'lesson_localizations',
  'lesson_resources',
  'lesson_vocabulary',
  'login_histories',
  'maintenance_modes',
  'marketing_analytics',
  'menu_items',
  'meta_capi_events',
  'meta_conversion_analytics',
  'module_localizations',
  'notification_logs',
  'notification_preferences',
  'notification_queue',
  'notification_recipients',
  'notification_retry_logs',
  'page_blocks',
  'page_translations',
  'page_versions',
  'password_resets',
  'payment_callbacks',
  'push_notifications',
  'question_blank_answers',
  'question_hints',
  'question_matching_pairs',
  'question_media',
  'question_passages',
  'question_tag_relations',
  'question_tags',
  'refunds',
  'retention_analytics',
  'revenue_analytics',
  'reward_redemptions',
  'rewards',
  'role_permissions',
  'scalev_analytics',
  'scalev_enrollments',
  'scheduled_jobs',
  'setting_histories',
  'sms_logs',
  'speaking_analytics',
  'storage_providers',
  'system_backups',
  'user_achievements',
  'user_badges',
  'user_challenges',
  'user_devices',
  'user_learning_analytics',
  'user_levels',
  'user_sessions',
  'video_analytics',
  'whatsapp_logs'
];

async function cleanup() {
  console.log(`Starting cleanup of ${tablesToDrop.length} unused tables...`);
  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    let droppedCount = 0;
    for (const table of tablesToDrop) {
      try {
        await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
        console.log(`🗑️ Dropped: ${table}`);
        droppedCount++;
      } catch (err: any) {
        console.warn(`⚠️ Could not drop ${table}: ${err.message}`);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`\n✅ Successfully cleaned up ${droppedCount} unused tables.`);
  } catch (error) {
    console.error('Error during database cleanup:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

cleanup();
