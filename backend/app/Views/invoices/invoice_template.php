<?php
  $amount    = $invoice['amount_cents'] / 100;
  $currency  = $invoice['currency'];
  $symbol    = ['USD' => '$', 'EUR' => '€', 'GBP' => '£', 'ZAR' => 'R', 'ZWL' => 'Z$'][$currency] ?? ($currency . ' ');
  $planLine  = $invoice['plan_name'] . ' — ' . ucfirst($invoice['billing_cycle']) . ' Subscription';
  $issuedFmt = date('M j, Y', strtotime($invoice['issued_at']));
  $fmt       = fn($n) => $symbol . number_format($n, 2);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { margin: 0; }
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 13px; color: #111; background: #fff; }
  .page { padding: 52px 56px; }

  .top-header { width: 100%; margin-bottom: 8px; }
  .top-header td { vertical-align: middle; }
  .logo-img { width: 160px; height: auto; }
  .invoice-title { font-size: 34px; font-weight: 700; color: #111; letter-spacing: 2px; text-transform: uppercase; text-align: right; }
  .invoice-num { font-size: 13px; color: #6b7280; text-align: right; margin-top: 4px; }

  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }

  .info-table { width: 100%; margin-bottom: 32px; }
  .info-table td { vertical-align: top; font-size: 13px; line-height: 1.75; }
  .info-left { width: 45%; }
  .info-right { width: 55%; text-align: right; }
  .from-name { font-weight: 700; color: #111; }
  .from-detail { color: #4b5563; }
  .bill-label { color: #9ca3af; font-size: 12px; margin-top: 16px; }
  .bill-name { font-weight: 700; color: #111; }
  .meta-label { color: #9ca3af; font-size: 12px; }
  .meta-value { font-size: 13px; color: #111; }
  .balance-box { background: #f3f4f6; border-radius: 6px; padding: 10px 16px; display: inline-block; margin-top: 6px; }
  .balance-box-label { font-weight: 700; color: #111; font-size: 13px; }
  .balance-box-val { font-weight: 700; color: #111; font-size: 13px; }

  .items { width: 100%; border-collapse: collapse; margin-top: 28px; margin-bottom: 8px; }
  .items thead tr { background: #111; color: #fff; }
  .items th { font-size: 13px; font-weight: 700; text-align: left; padding: 12px 14px; }
  .items th.r { text-align: right; }
  .items td { font-size: 13px; color: #111; padding: 16px 14px; font-weight: 700; }
  .items td.r { text-align: right; font-weight: 400; color: #4b5563; }
  .items tr.item-row td { border-bottom: 1px solid #f3f4f6; }

  .totals { width: 100%; margin-top: 12px; }
  .totals td { padding: 5px 14px; font-size: 13px; }
  .totals .sp { width: 52%; }
  .totals .tl { text-align: right; color: #6b7280; }
  .totals .tv { text-align: right; color: #111; width: 20%; }
  .totals .grand td { padding-top: 14px; }
  .totals .grand .tl { font-weight: 700; color: #111; font-size: 14px; }
  .totals .grand .tv { font-weight: 700; color: #111; font-size: 14px; }

  .paid-stamp { display: inline-block; border: 3px solid #16a34a; color: #16a34a; font-size: 18px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; padding: 4px 14px; border-radius: 4px; margin-top: 8px; opacity: 0.85; }

  .footer { margin-top: 56px; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 11px; color: #9ca3af; }
  .footer td { padding-right: 24px; vertical-align: top; }
</style>
</head>
<body>
<div class="page">

  <!-- ================= TOP HEADER ================= -->
  <table class="top-header">
    <tr>
      <td style="width:50%">
        <?php if (!empty($logoDataUri)): ?>
          <img class="logo-img" src="<?= $logoDataUri ?>" alt="SchoolLedger"/>
        <?php else: ?>
          <span style="font-size:22px;font-weight:700;color:#1e3a8a;">SchoolLedger</span>
        <?php endif; ?>
      </td>
      <td style="width:50%">
        <div class="invoice-title">Invoice</div>
        <div class="invoice-num"># <?= esc($invoice['invoice_number']) ?></div>
        <div style="text-align:right;margin-top:10px;"><span class="paid-stamp">Paid</span></div>
      </td>
    </tr>
  </table>

  <hr class="divider"/>

  <!-- ================= INFO SECTION ================= -->
  <table class="info-table">
    <tr>
      <td class="info-left">
        <div class="from-name">SchoolLedger</div>
        <div class="from-detail">Finance Department</div>
        <div class="from-detail">support@schoolledger.co.zw</div>
        <div class="from-detail">www.schoolledger.co.zw</div>
        <div class="bill-label">Bill to:</div>
        <div class="bill-name"><?= esc($invoice['school_name']) ?></div>
      </td>
      <td class="info-right">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="text-align:right;color:#9ca3af;font-size:12px;padding-bottom:4px;">Date:</td>
            <td style="text-align:right;font-size:13px;color:#111;padding-bottom:4px;padding-left:16px;"><?= $issuedFmt ?></td>
          </tr>
          <tr>
            <td style="text-align:right;color:#9ca3af;font-size:12px;padding-bottom:4px;">Payment Terms:</td>
            <td style="text-align:right;font-size:13px;color:#111;padding-bottom:4px;padding-left:16px;">Due on Receipt</td>
          </tr>
          <tr>
            <td style="text-align:right;color:#9ca3af;font-size:12px;padding-bottom:4px;">Due Date:</td>
            <td style="text-align:right;font-size:13px;color:#111;padding-bottom:4px;padding-left:16px;"><?= $issuedFmt ?></td>
          </tr>
          <tr>
            <td style="text-align:right;color:#9ca3af;font-size:12px;padding-bottom:4px;">Amount Paid:</td>
            <td style="text-align:right;font-size:13px;color:#16a34a;font-weight:700;padding-bottom:4px;padding-left:16px;"><?= $fmt($amount) ?></td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:8px;">
              <table style="width:100%;background:#f3f4f6;border-radius:6px;">
                <tr>
                  <td style="padding:10px 14px;font-weight:700;font-size:13px;color:#16a34a;">Amount Paid:</td>
                  <td style="padding:10px 14px;font-weight:700;font-size:13px;color:#16a34a;text-align:right;"><?= $fmt($amount) ?></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ================= ITEMS ================= -->
  <table class="items">
    <thead>
      <tr>
        <th style="width:52%">Item</th>
        <th class="r" style="width:14%">Quantity</th>
        <th class="r" style="width:17%">Rate</th>
        <th class="r" style="width:17%">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr class="item-row">
        <td><?= esc($planLine) ?></td>
        <td class="r">1</td>
        <td class="r"><?= $fmt($amount) ?></td>
        <td class="r"><?= $fmt($amount) ?></td>
      </tr>
    </tbody>
  </table>

  <!-- ================= TOTALS ================= -->
  <table class="totals">
    <tr>
      <td class="sp"></td>
      <td class="tl">Subtotal:</td>
      <td class="tv"><?= $fmt($amount) ?></td>
    </tr>
    <tr>
      <td class="sp"></td>
      <td class="tl">Tax (0%):</td>
      <td class="tv"><?= $fmt(0) ?></td>
    </tr>
    <tr class="grand">
      <td class="sp"></td>
      <td class="tl">Total:</td>
      <td class="tv"><?= $fmt($amount) ?></td>
    </tr>
  </table>

  <!-- ================= FOOTER ================= -->
  <table class="footer">
    <tr>
      <td>support@schoolledger.app</td>
      <td>www.schoolledger.app</td>
      <td style="text-align:right">Invoice <?= esc($invoice['invoice_number']) ?> &nbsp;&middot;&nbsp; Generated <?= date('d M Y') ?></td>
    </tr>
  </table>

</div>
</body>
</html>
