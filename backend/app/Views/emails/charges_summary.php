<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Charges Generated — SchoolLedger</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f7fa; }
    .e-wrap { font-family: Arial, sans-serif; background: #f5f7fa; padding: 32px 0; }
    .e-inner { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    .e-header { background: linear-gradient(135deg, #1e4d8c 0%, #2d6a2d 100%); padding: 28px 40px; text-align: center; }
    .e-header img { height: 44px; object-fit: contain; }
    .e-hero { padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .e-hero-icon { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 20px; background: #eff6ff; display: flex; align-items: center; justify-content: center; }
    .e-hero-icon svg { width: 32px; height: 32px; }
    .e-hero h1 { font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3; margin-bottom: 10px; }
    .e-hero p { font-size: 15px; color: #475569; line-height: 1.65; max-width: 420px; margin: 0 auto; }
    .e-body { padding: 32px 40px; }
    .e-body p { font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 16px; }
    .e-body p:last-child { margin-bottom: 0; }
    .e-stats { display: table; width: 100%; border-collapse: collapse; margin: 20px 0; }
    .e-stat { display: table-cell; text-align: center; padding: 20px 16px; background: #f8fafc; border-radius: 8px; }
    .e-stat-grid { width: 100%; border-collapse: separate; border-spacing: 8px; margin: 20px 0; }
    .e-stat-grid td { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; width: 33%; border: 1px solid #e2e8f0; }
    .e-stat-num { font-size: 26px; font-weight: 700; color: #1e4d8c; display: block; }
    .e-stat-label { font-size: 12px; color: #64748b; margin-top: 4px; display: block; }
    .e-details { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .e-details td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .e-details td:first-child { color: #64748b; width: 45%; font-weight: 500; }
    .e-details td:last-child { color: #1e293b; font-weight: 600; }
    .e-cta { text-align: center; padding: 8px 40px 32px; }
    .e-btn { display: inline-block; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; letter-spacing: .01em; background: #1e4d8c; color: #fff; }
    .e-divider { border: none; border-top: 1px solid #f1f5f9; margin: 0 40px; }
    .e-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; }
    .e-footer p { font-size: 12px; color: #94a3b8; line-height: 1.7; margin-bottom: 4px; }
    .e-footer a { color: #1e4d8c; text-decoration: none; }
    .e-footer-links { margin-top: 12px; text-align: center; }
    .e-footer-links a { font-size: 12px; color: #64748b; text-decoration: none; margin: 0 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
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
          <svg viewBox="0 0 24 24" fill="none" stroke="#1e4d8c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <h1>Charges Generated Successfully</h1>
        <p>Fee charges have been applied to students at <strong><?= esc($school_name) ?></strong> for <strong><?= esc($term_id) ?></strong>.</p>
      </div>

      <div class="e-body">
        <p>Hi <strong><?= esc($recipient_name) ?></strong>,</p>
        <p>This is a summary of the fee charges that were just generated. All active students have been billed according to the configured fee structure.</p>

        <table class="e-stat-grid">
          <tr>
            <td>
              <span class="e-stat-num"><?= (int) $generated_count ?></span>
              <span class="e-stat-label">Charges Created</span>
            </td>
            <td>
              <span class="e-stat-num"><?= (int) $students_affected ?></span>
              <span class="e-stat-label">Students Billed</span>
            </td>
            <td>
              <span class="e-stat-num"><?= esc($currency) ?>&nbsp;<?= number_format($total_amount, 2) ?></span>
              <span class="e-stat-label">Total Amount</span>
            </td>
          </tr>
        </table>

        <table class="e-details">
          <tr>
            <td>School</td>
            <td><?= esc($school_name) ?></td>
          </tr>
          <tr>
            <td>Term</td>
            <td><?= esc($term_id) ?></td>
          </tr>
          <tr>
            <td>Generated On</td>
            <td><?= esc($generated_at) ?></td>
          </tr>
          <tr>
            <td>Generated By</td>
            <td><?= esc($recipient_name) ?></td>
          </tr>
          <tr>
            <td>Batch ID</td>
            <td><span class="badge badge-blue"><?= esc($batch_id) ?></span></td>
          </tr>
        </table>

        <p>Students can view their outstanding charges in their individual ledger. If you need to make corrections, individual charges can be managed from the Charges section of the portal.</p>
      </div>

      <div class="e-cta">
        <a href="<?= esc($ledger_url) ?>" class="e-btn">View Charges in Portal</a>
      </div>

      <hr class="e-divider" />

      <div class="e-body" style="padding-top:24px; padding-bottom:8px;">
        <p style="font-size:14px;color:#64748b;">Questions or concerns about these charges? Contact us at <a href="mailto:<?= esc($support_email) ?>" style="color:#1e4d8c;"><?= esc($support_email) ?></a>.</p>
      </div>

      <div class="e-footer">
        <p>This summary was sent to <strong><?= esc($recipient_email) ?></strong></p>
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
