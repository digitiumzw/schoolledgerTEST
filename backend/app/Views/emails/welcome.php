<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to SchoolLedger</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f7fa; }
    .e-wrap { font-family: Arial, sans-serif; background: #f5f7fa; padding: 32px 0; }
    .e-inner { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .e-header { background: linear-gradient(135deg, #1e4d8c 0%, #2d6a2d 100%); padding: 28px 40px; text-align: center; }
    .e-header img { height: 44px; object-fit: contain; }
    .e-hero { padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .e-hero-icon { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; background: #f0fdf4; }
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
    .e-infobox { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2d6a2d; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .e-infobox-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
    .e-infobox-val { font-size: 15px; font-weight: 600; color: #1e293b; }
    .e-cta { text-align: center; padding: 8px 40px 32px; }
    .e-btn { display: inline-block; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: .01em; background: #2d6a2d; color: #fff; }
    .e-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0 40px; }
    .e-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; }
    .e-footer p { font-size: 12px; color: #94a3b8; line-height: 1.7; margin-bottom: 4px; }
    .e-footer a { color: #1e4d8c; text-decoration: none; }
    .e-footer-links { margin-top: 12px; text-align: center; }
    .e-footer-links a { font-size: 12px; color: #64748b; text-decoration: none; margin: 0 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-blue  { background: #dbeafe; color: #1e40af; }
    .e-trial { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #1e4d8c; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .e-trial-header { display: flex; align-items: center; margin-bottom: 8px; gap: 8px; }
    .e-trial-title { font-size: 13px; font-weight: 700; color: #1e3a8a; }
    .e-trial p { font-size: 14px; color: #334155; line-height: 1.65; margin: 0; }
    .e-trial-meta { margin-top: 10px; font-size: 13px; color: #64748b; }
    .e-trial-meta strong { color: #1e293b; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; }
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
          <svg viewBox="0 0 24 24" fill="none" stroke="#2d6a2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h1>Welcome to SchoolLedger!</h1>
        <p>Your admin account has been created. You're all set to manage your school's finances, attendance, and more — all in one place.</p>
      </div>

      <div class="e-body">
        <p>Hi <strong><?= esc($recipient_name) ?></strong>,</p>
        <p>We're excited to have <strong><?= esc($school_name) ?></strong> on SchoolLedger. Your account is ready and waiting. Here are your login details:</p>

        <table class="e-details">
          <tr>
            <td>Portal URL</td>
            <td><a href="<?= esc($login_url) ?>" style="color:#1e4d8c;"><?= esc($login_url) ?></a></td>
          </tr>
          <tr>
            <td>Email / Username</td>
            <td><?= esc($recipient_email) ?></td>
          </tr>
          <tr>
            <td>Temporary Password</td>
            <td><code><?= esc($temp_password) ?></code></td>
          </tr>
          <tr>
            <td>Role</td>
            <td><span class="badge badge-green">Admin</span></td>
          </tr>
        </table>

        <div class="e-trial">
          <div class="e-trial-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e4d8c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span class="e-trial-title">1-Month Free Enterprise Trial — Activated</span>
            <span class="badge badge-blue">Free Trial</span>
          </div>
          <p>A <strong>1-month free trial of the Enterprise plan</strong> has been granted to <strong><?= esc($school_name) ?></strong>, starting from today. You'll have full, unlimited access to all SchoolLedger features with no payment required during the trial period.</p>
          <div class="e-trial-meta">
            <strong>Trial starts:</strong> <?= date('d M Y') ?> &nbsp;&bull;&nbsp;
            <strong>Trial ends:</strong> <?= date('d M Y', strtotime('+1 month')) ?>
          </div>
        </div>

        <div class="e-infobox">
          <div class="e-infobox-label">Next Step</div>
          <div class="e-infobox-val">Please log in and change your password immediately.</div>
        </div>

        <p>Once you're in, you can set up your school profile, import students, configure fee structures, and start tracking attendance right away.</p>
      </div>

      <div class="e-cta">
        <a href="<?= esc($login_url) ?>" class="e-btn">Log In to SchoolLedger</a>
      </div>

      <hr class="e-divider" />

      <div class="e-body" style="padding-top:24px; padding-bottom:8px;">
        <p style="font-size:14px;color:#64748b;"><strong style="color:#334155;">Need help getting started?</strong><br />
        Visit our <a href="mailto:<?= esc($support_email) ?>" style="color:#1e4d8c;">Help Center</a> or reach out to our support team at <a href="mailto:<?= esc($support_email) ?>" style="color:#1e4d8c;"><?= esc($support_email) ?></a>. We're happy to help.</p>
      </div>

      <div class="e-footer">
        <p>This invitation was sent to <strong><?= esc($recipient_email) ?></strong></p>
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
