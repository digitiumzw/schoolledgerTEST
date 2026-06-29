<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Invoice — SchoolLedger</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f7fa; }
    .e-wrap { font-family: Arial, sans-serif; background: #f5f7fa; padding: 32px 0; }
    .e-inner { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .e-header { background: linear-gradient(135deg, #1e4d8c 0%, #2d6a2d 100%); padding: 28px 40px; text-align: center; }
    .e-header img { height: 44px; object-fit: contain; }
    .e-hero { padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .e-hero-icon { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 20px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; }
    .e-hero-icon svg { width: 32px; height: 32px; }
    .e-hero h1 { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3; margin-bottom: 10px; }
    .e-hero p { font-size: 15px; color: #475569; line-height: 1.65; max-width: 420px; margin: 0 auto; }
    .e-body { padding: 32px 40px; }
    .e-body p { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 16px; }
    .e-body p:last-child { margin-bottom: 0; }
    .e-details { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .e-details td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .e-details td:first-child { color: #64748b; width: 45%; font-weight: 500; }
    .e-details td:last-child { color: #1e293b; font-weight: 600; }
    .e-attach-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 20px 0; display: flex; align-items: center; gap: 14px; }
    .e-attach-icon { color: #1e4d8c; flex-shrink: 0; }
    .e-attach-icon svg { width: 24px; height: 24px; }
    .e-attach-text strong { font-size: 14px; color: #1e293b; display: block; }
    .e-attach-text span { font-size: 12px; color: #64748b; }
    .e-cta { text-align: center; padding: 8px 40px 32px; }
    .e-btn { display: inline-block; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: .01em; background: #1e4d8c; color: #fff; }
    .e-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0 40px; }
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
          <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <h1>Invoice <?= esc($invoice_number) ?></h1>
        <p>Your invoice for the SchoolLedger subscription is attached to this email as a PDF.</p>
      </div>

      <div class="e-body">
        <p>Hi <strong><?= esc($recipient_name) ?></strong>,</p>
        <p>Please find your invoice attached to this email. Keep it for your records.</p>

        <div class="e-attach-box">
          <span class="e-attach-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </span>
          <div class="e-attach-text">
            <strong><?= esc($invoice_number) ?>.pdf</strong>
            <span>SchoolLedger subscription invoice — <?= esc($currency) ?> <?= number_format($amount_cents / 100, 2) ?></span>
          </div>
        </div>

        <table class="e-details">
          <tr>
            <td>Invoice Number</td>
            <td><?= esc($invoice_number) ?></td>
          </tr>
          <tr>
            <td>School</td>
            <td><?= esc($school_name) ?></td>
          </tr>
          <tr>
            <td>Plan</td>
            <td><?= esc($plan_name) ?> (<?= esc(ucfirst($billing_cycle)) ?>)</td>
          </tr>
          <tr>
            <td>Amount</td>
            <td><?= esc($currency) ?> <?= number_format($amount_cents / 100, 2) ?></td>
          </tr>
          <tr>
            <td>Issued</td>
            <td><?= esc($issued_at) ?></td>
          </tr>
        </table>

        <p>You can also view and download all past invoices at any time from the <strong>Billing</strong> section of your portal.</p>
      </div>

      <div class="e-cta">
        <a href="<?= esc($billing_url) ?>" class="e-btn">View All Invoices</a>
      </div>

      <hr class="e-divider" />

      <div class="e-body" style="padding-top:24px; padding-bottom:8px;">
        <p style="font-size:14px;color:#64748b;">Billing questions? Email us at <a href="mailto:<?= esc($support_email) ?>" style="color:#1e4d8c;"><?= esc($support_email) ?></a>.</p>
      </div>

      <div class="e-footer">
        <p>This invoice was sent to <strong><?= esc($recipient_email) ?></strong></p>
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
