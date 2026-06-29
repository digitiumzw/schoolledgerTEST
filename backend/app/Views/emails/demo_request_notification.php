<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Demo Request — <?= esc($platform_name) ?></title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f7fa; }
    .e-wrap { font-family: Arial, sans-serif; background: #f5f7fa; padding: 32px 0; }
    .e-inner { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .e-header { background: linear-gradient(135deg, #1e4d8c 0%, #2d6a2d 100%); padding: 28px 40px; text-align: center; }
    .e-header img { height: 44px; object-fit: contain; }
    .e-hero { padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .e-hero-icon { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; background: #eff6ff; }
    .e-hero-icon svg { width: 28px; height: 28px; }
    .e-hero h1 { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3; margin-bottom: 10px; }
    .e-hero p { font-size: 15px; color: #475569; line-height: 1.65; max-width: 420px; margin: 0 auto; }
    .e-body { padding: 32px 40px; }
    .e-body p { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 16px; }
    .e-details { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .e-details td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .e-details td:first-child { color: #64748b; width: 42%; font-weight: 500; }
    .e-details td:last-child { color: #1e293b; font-weight: 600; }
    .e-cta { text-align: center; padding: 8px 40px 32px; }
    .e-btn { display: inline-block; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: .01em; background: #1e4d8c; color: #fff; }
    .e-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; background: #dbeafe; color: #1e40af; letter-spacing: .04em; text-transform: uppercase; }
    .e-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0 40px; }
    .e-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; }
    .e-footer p { font-size: 12px; color: #94a3b8; line-height: 1.7; margin-bottom: 4px; }
    .e-footer a { color: #1e4d8c; text-decoration: none; }
  </style>
</head>
<body>
  <div class="e-wrap">
    <div class="e-inner">

      <div class="e-header">
        <img src="<?= esc($logo_url) ?>" alt="<?= esc($platform_name) ?>" />
      </div>

      <div class="e-hero">
        <div class="e-hero-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#1e4d8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
        </div>
        <h1>New Demo Request <span class="e-badge">Action Required</span></h1>
        <p>A school has submitted a demo request through the landing page. Review the details below and follow up within 24 hours.</p>
      </div>

      <div class="e-body">
        <p>Hi team,</p>
        <p>A new demo request was submitted on <strong><?= esc($submitted_at) ?></strong>. Here are the details:</p>

        <table class="e-details">
          <tr>
            <td>School Name</td>
            <td><?= esc($school_name) ?></td>
          </tr>
          <tr>
            <td>Contact Email</td>
            <td><a href="mailto:<?= esc($contact_email) ?>" style="color:#1e4d8c;"><?= esc($contact_email) ?></a></td>
          </tr>
          <tr>
            <td>School Address</td>
            <td><?= esc($school_address) ?></td>
          </tr>
          <tr>
            <td>Est. Students</td>
            <td><?= esc(number_format($estimated_students)) ?></td>
          </tr>
        </table>

        <p style="font-size:14px;color:#64748b;">Log in to the platform control panel to view this request, add notes, and convert it into a new school account.</p>
      </div>

      <div class="e-cta">
        <a href="<?= esc($admin_url) ?>" class="e-btn">View in Control Panel</a>
      </div>

      <hr class="e-divider" />

      <div class="e-footer">
        <p>&copy; <?= date('Y') ?> <?= esc($platform_name) ?>. Internal notification — do not reply.</p>
      </div>

    </div>
  </div>
</body>
</html>
