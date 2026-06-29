<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to SchoolLedger</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f7fa; }
    .e-wrap { font-family: Arial, sans-serif; background: #f5f7fa; padding: 32px 0; }
    .e-inner { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .e-header { background: linear-gradient(135deg, #1e4d8c 0%, #2d6a2d 100%); padding: 28px 40px; text-align: center; }
    .e-header img { height: 44px; object-fit: contain; }
    .e-hero { padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .e-hero-icon { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; background: #eff6ff; }
    .e-hero-icon svg { width: 28px; height: 28px; }
    .e-hero h1 { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3; margin-bottom: 10px; }
    .e-hero p { font-size: 15px; color: #475569; line-height: 1.65; max-width: 420px; margin: 0 auto; }
    .e-body { padding: 32px 40px; }
    .e-body p { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 16px; }
    .e-body p:last-child { margin-bottom: 0; }
    .e-infobox { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #1e4d8c; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .e-infobox-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
    .e-infobox-val { font-size: 15px; font-weight: 600; color: #1e293b; }
    .e-cta { text-align: center; padding: 8px 40px 32px; }
    .e-btn { display: inline-block; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: .01em; background: #1e4d8c; color: #fff; }
    .e-linkhint { padding: 0 40px 24px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
    .e-linkhint a { color: #1e4d8c; text-decoration: underline; word-break: break-all; }
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
          <svg viewBox="0 0 24 24" fill="none" stroke="#1e4d8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <line x1="19" y1="8" x2="19" y2="14"></line>
            <line x1="22" y1="11" x2="16" y2="11"></line>
          </svg>
        </div>
        <h1>You're Invited to SchoolLedger</h1>
        <p>An administrator has invited you to join their school's SchoolLedger account. Click below to accept and set your password.</p>
      </div>

      <div class="e-body">
        <p>Hi <strong><?= esc($recipient_name) ?></strong>,</p>
        <p>You've been invited to join <strong>SchoolLedger</strong>. To activate your account, click the button below to set your password — this link expires in <strong>48 hours</strong>.</p>

        <div class="e-infobox">
          <div class="e-infobox-label">Account</div>
          <div class="e-infobox-val"><?= esc($recipient_email) ?></div>
        </div>

        <p>After setting your password, you'll be redirected to the sign-in page where you can log in with your new credentials.</p>
      </div>

      <div class="e-cta">
        <a href="<?= esc($invite_link) ?>" class="e-btn">Accept Invitation &amp; Set Password</a>
      </div>

      <div class="e-linkhint">
        Button not working? Copy and paste this link into your browser:<br />
        <a href="<?= esc($invite_link) ?>"><?= esc($invite_link) ?></a>
      </div>

      <hr class="e-divider" />

      <div class="e-body" style="padding-top:24px;">
        <div class="e-warning">
          <span class="e-warning-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </span>
          <p><strong>Didn't expect this invitation?</strong> You can safely ignore this email. The invitation will expire automatically after 48 hours.</p>
        </div>
      </div>

      <div class="e-footer">
        <p>This email was sent to <strong><?= esc($recipient_email) ?></strong></p>
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
