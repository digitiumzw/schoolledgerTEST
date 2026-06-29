<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Account Deletion Reminder — SchoolLedger</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f7fa; }
    .e-wrap { font-family: Arial, sans-serif; background: #f5f7fa; padding: 32px 0; }
    .e-inner { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .e-header { background: linear-gradient(135deg, #1e4d8c 0%, #2d6a2d 100%); padding: 28px 40px; text-align: center; }
    .e-header img { height: 44px; object-fit: contain; }
    .e-hero { padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .e-hero-icon { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; background: #fffbeb; }
    .e-hero-icon svg { width: 28px; height: 28px; }
    .e-hero h1 { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3; margin-bottom: 10px; }
    .e-hero p { font-size: 15px; color: #475569; line-height: 1.65; max-width: 420px; margin: 0 auto; }
    .e-body { padding: 32px 40px; }
    .e-body p { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 16px; }
    .e-body p:last-child { margin-bottom: 0; }
    .e-details { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .e-details td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .e-details td:first-child { color: #64748b; width: 45%; font-weight: 500; }
    .e-details td:last-child { color: #1e293b; font-weight: 600; }
    .e-cta { text-align: center; padding: 8px 40px 32px; }
    .e-btn { display: inline-block; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: .01em; background: #d97706; color: #fff; }
    .e-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0 40px; }
    .e-warning { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin: 20px 0; display: flex; gap: 14px; align-items: flex-start; }
    .e-warning-icon { flex-shrink: 0; margin-top: 1px; color: #d97706; }
    .e-warning-icon svg { width: 20px; height: 20px; }
    .e-warning p { font-size: 14px; color: #92400e; line-height: 1.6; margin: 0; }
    .e-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; }
    .e-footer p { font-size: 12px; color: #94a3b8; line-height: 1.7; margin-bottom: 4px; }
    .e-footer a { color: #1e4d8c; text-decoration: none; }
    .e-footer-links { margin-top: 12px; text-align: center; }
    .e-footer-links a { font-size: 12px; color: #64748b; text-decoration: none; margin: 0 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge-amber { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="e-wrap">
    <div class="e-inner">

      <div class="e-header">
        <img src="<?= esc($logo_url) ?>" alt="SchoolLedger" />
      </div>

      <div class="e-hero">
        <div class="e-hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h1>Account Deletion Reminder</h1>
        <p>Your SchoolLedger account for <strong><?= esc($school_name) ?></strong> is scheduled for deletion in <strong><?= (int)$remaining_days ?> days</strong>. Act now to keep your account.</p>
      </div>

      <div class="e-body">
        <p>Hi <strong><?= esc($recipient_name) ?></strong>,</p>
        <p>This is a reminder that a deletion request is pending for the SchoolLedger account for <strong><?= esc($school_name) ?></strong>. You still have time to cancel it.</p>

        <table class="e-details">
          <tr>
            <td>School</td>
            <td><?= esc($school_name) ?></td>
          </tr>
          <tr>
            <td>Time Remaining</td>
            <td><strong style="color:#d97706;"><?= (int)$remaining_days ?> days</strong></td>
          </tr>
          <tr>
            <td>Status</td>
            <td><span class="badge badge-amber">Pending Deletion</span></td>
          </tr>
        </table>

        <div class="e-warning">
          <span class="e-warning-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </span>
          <p>If you do not cancel this request, all data for <strong><?= esc($school_name) ?></strong> — including students, payments, attendance records, and user accounts — will be <strong>permanently deleted</strong> and cannot be recovered.</p>
        </div>

        <p>To cancel the deletion, go to <strong>Settings → Account</strong> and click <strong>"Undo Account Deletion"</strong>.</p>
      </div>

      <div class="e-cta">
        <a href="<?= esc($settings_url) ?>" class="e-btn">Undo Deletion in Account Settings</a>
      </div>

      <hr class="e-divider" />

      <div class="e-body" style="padding-top:24px; padding-bottom:8px;">
        <p style="font-size:14px;color:#64748b;">Questions? Contact us at <a href="mailto:<?= esc($support_email) ?>" style="color:#1e4d8c;"><?= esc($support_email) ?></a> and we'll respond within one business day.</p>
      </div>

      <div class="e-footer">
        <p>This notice was sent to <strong><?= esc($recipient_email) ?></strong></p>
        <p>&copy; <?= date('Y') ?> SchoolLedger. All rights reserved.</p>
        <div class="e-footer-links">
          <a href="<?= esc($app_url) ?>/privacy">Privacy Policy</a>
          <a href="<?= esc($app_url) ?>/terms">Terms of Service</a>
          <a href="mailto:<?= esc($support_email) ?>">Help Center</a>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
