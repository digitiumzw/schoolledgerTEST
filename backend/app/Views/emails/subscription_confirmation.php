<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Subscription Confirmed — SchoolLedger</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f7fa; }
    .e-wrap { font-family: Arial, sans-serif; background: #f5f7fa; padding: 32px 0; }
    .e-inner { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .e-header { background: linear-gradient(135deg, #1e4d8c 0%, #2d6a2d 100%); padding: 28px 40px; text-align: center; }
    .e-header img { height: 44px; object-fit: contain; }
    .e-hero { padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .e-hero-icon { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 20px; background: #dcfce7; display: flex; align-items: center; justify-content: center; }
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
    .e-cta { text-align: center; padding: 8px 40px 32px; }
    .e-btn { display: inline-block; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: .01em; background: #1e4d8c; color: #fff; }
    .e-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0 40px; }
    .e-success { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .e-success p { font-size: 14px; color: #166534; line-height: 1.6; margin: 0; }
    .e-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; }
    .e-footer p { font-size: 12px; color: #94a3b8; line-height: 1.7; margin-bottom: 4px; }
    .e-footer a { color: #1e4d8c; text-decoration: none; }
    .e-footer-links { margin-top: 12px; text-align: center; }
    .e-footer-links a { font-size: 12px; color: #64748b; text-decoration: none; margin: 0 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
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
          <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h1>Subscription Activated!</h1>
        <p>Your SchoolLedger subscription for <strong><?= esc($school_name) ?></strong> is now active. Your school has full access to all features included in your plan.</p>
      </div>

      <div class="e-body">
        <p>Hi <strong><?= esc($recipient_name) ?></strong>,</p>
        <p>Thank you for your payment. Your subscription has been confirmed and your account is ready to use.</p>

        <div class="e-success">
          <p>&#10003; &nbsp;Payment received and subscription activated successfully.</p>
        </div>

        <table class="e-details">
          <tr>
            <td>School</td>
            <td><?= esc($school_name) ?></td>
          </tr>
          <tr>
            <td>Plan</td>
            <td><span class="badge badge-green"><?= esc($plan_name) ?></span></td>
          </tr>
          <tr>
            <td>Billing Cycle</td>
            <td><?= esc(ucfirst($billing_cycle)) ?></td>
          </tr>
          <tr>
            <td>Amount Paid</td>
            <td><strong><?= esc($currency) ?> <?= number_format($amount_cents / 100, 2) ?></strong></td>
          </tr>
          <tr>
            <td>Activated</td>
            <td><?= esc($activated_at) ?></td>
          </tr>
          <tr>
            <td>Valid Until</td>
            <td><strong><?= esc($expires_at) ?></strong></td>
          </tr>
          <tr>
            <td>Invoice</td>
            <td><span class="badge badge-blue"><?= esc($invoice_number) ?></span></td>
          </tr>
        </table>

        <p>Your invoice has been sent as a separate attachment to this email. You can also view and download all your invoices from the Billing section of your portal.</p>
      </div>

      <div class="e-cta">
        <a href="<?= esc($billing_url) ?>" class="e-btn">View Billing Dashboard</a>
      </div>

      <hr class="e-divider" />

      <div class="e-body" style="padding-top:24px; padding-bottom:8px;">
        <p style="font-size:14px;color:#64748b;">Questions about your subscription? Contact us at <a href="mailto:<?= esc($support_email) ?>" style="color:#1e4d8c;"><?= esc($support_email) ?></a> and we'll assist you within one business day.</p>
      </div>

      <div class="e-footer">
        <p>This receipt was sent to <strong><?= esc($recipient_email) ?></strong></p>
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
