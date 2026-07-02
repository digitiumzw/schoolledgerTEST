<?php
/**
 * Financial Report PDF Template
 *
 * Variables injected by FinancialReportService:
 * @var string   $schoolName
 * @var string   $logoDataUri
 * @var string   $reportTitle
 * @var string   $periodLabel
 * @var string   $generatedAt
 * @var float    $totalExpectedFees
 * @var float    $totalPaymentsReceived
 * @var float    $outstandingBalance
 * @var float    $totalAdjustments
 * @var float    $collectionRate
 * @var array    $methodBreakdown   [{method, count, total}]
 * @var array    $chargesSummary    [{category, total}]
 * @var array    $transactions      [{date, studentName, className, amount, method, category, receiptNumber, isVoided, currencyCode, originalAmount, exchangeRate}]
 * @var string   $currency
 * @var string   $baseCurrency
 */

$fmt = function (float $n) use ($currency): string {
    return $currency . ' ' . number_format($n, 2);
};
$fmtBase = function (float $n) use ($baseCurrency): string {
    return $baseCurrency . ' ' . number_format($n, 2);
};
$fmtOrig = function (float $n, string $code): string {
    return $code . ' ' . number_format($n, 2);
};
$fmtPct = fn($n): string => number_format((float) $n, 1) . '%';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 4px; padding: 0; box-sizing: border-box; }
  /* @page { margin: 25.4mm 25.4mm 25.4mm 25.4mm; } */
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }

  /* ── Header ── */
  .rpt-header { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .rpt-header td { vertical-align: middle; }
  .logo-img { width: 130px; height: auto; }
  .header-right { text-align: right; }
  .school-name { font-size: 17px; font-weight: 700; color: #1e3a8a; }
  .report-title { font-size: 14px; font-weight: 700; color: #111; margin-top: 3px; }
  .period-label { font-size: 11px; color: #4b5563; margin-top: 2px; }
  .generated-at { font-size: 10px; color: #9ca3af; margin-top: 2px; }

  .divider { border: none; border-top: 2px solid #1e3a8a; margin: 10px 0 14px; }
  .divider-thin { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }

  /* ── Section headings ── */
  .section-title { font-size: 12px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;
                   letter-spacing: 1px; margin-bottom: 8px; padding-bottom: 3px;
                   border-bottom: 1px solid #bfdbfe; }

  /* ── Summary cards ── */
  .summary-grid { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .summary-grid td { width: 20%; vertical-align: top; padding: 2px 4px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px;
                  padding: 8px 10px; }
  .summary-card .sc-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .sc-value { font-size: 14px; font-weight: 700; color: #111; margin-top: 2px; }
  .summary-card .sc-value.positive { color: #16a34a; }
  .summary-card .sc-value.negative { color: #dc2626; }
  .summary-card .sc-value.neutral  { color: #1d4ed8; }

  /* ── Tables ── */
  .data-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
  .data-table thead tr { background: #1e3a8a; color: #fff; }
  .data-table th { padding: 7px 8px; text-align: left; font-size: 10px; font-weight: 700; }
  .data-table th.r { text-align: right; }
  .data-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #111; vertical-align: top; }
  .data-table td.r { text-align: right; }
  .data-table td.muted { color: #6b7280; }
  .data-table tbody tr:nth-child(even) { background: #f8fafc; }
  .data-table tfoot td { font-weight: 700; border-top: 2px solid #1e3a8a; background: #eff6ff;
                          padding: 7px 8px; }
  .data-table tfoot td.r { text-align: right; }

  .voided-row td { color: #9ca3af !important; text-decoration: line-through; }
  .voided-badge { background: #fee2e2; color: #b91c1c; font-size: 8px; font-weight: 700;
                  padding: 1px 4px; border-radius: 2px; vertical-align: middle;
                  text-decoration: none; display: inline-block; }

  .empty-msg { text-align: center; color: #9ca3af; font-style: italic; padding: 14px 0; }

  /* ── Footer (every page via Dompdf page script) ── */
  .page-footer { position: fixed; bottom: -19mm; left: 0; right: 0; font-size: 9px;
                 color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 4px; }
  .page-footer table { width: 100%; border-collapse: collapse; }
  .page-footer .pf-left { text-align: left; }
  .page-footer .pf-center { text-align: center; }
  .page-footer .pf-right { text-align: right; }

  /* ── Page break control ── */
  .page-break { page-break-after: always; }
  .no-break { page-break-inside: avoid; }
</style>
</head>
<body>

<!-- ═══════════════ FIXED FOOTER (every page) ═══════════════ -->
<div class="page-footer">
  <table>
    <tr>
      <td class="pf-left">Confidential — <?= esc($schoolName) ?></td>
      <td class="pf-center">Generated <?= esc($generatedAt) ?></td>
      <td class="pf-right">Page <span class="pageNumber"></span> of <span class="pageCount"></span></td>
    </tr>
  </table>
</div>

<!-- ═══════════════ HEADER ═══════════════ -->
<table class="rpt-header">
  <tr>
    <td style="width:50%">
      <?php if (!empty($logoDataUri)): ?>
        <img class="logo-img" src="<?= $logoDataUri ?>" alt="<?= esc($schoolName) ?>"/>
      <?php else: ?>
        <span class="school-name"><?= esc($schoolName) ?></span>
      <?php endif; ?>
    </td>
    <td class="header-right" style="width:50%">
      <?php if (!empty($logoDataUri)): ?>
        <div class="school-name"><?= esc($schoolName) ?></div>
      <?php endif; ?>
      <div class="report-title"><?= esc($reportTitle) ?></div>
      <div class="period-label"><?= esc($periodLabel) ?></div>
      <div class="generated-at">Generated: <?= esc($generatedAt) ?></div>
    </td>
  </tr>
</table>
<hr class="divider"/>

<!-- ═══════════════ FINANCIAL SUMMARY ═══════════════ -->
<div class="section-title">Financial Summary</div>
<table class="summary-grid no-break">
  <tr>
    <td>
      <div class="summary-card">
        <div class="sc-label">Expected Fees</div>
        <div class="sc-value neutral"><?= $fmt($totalExpectedFees) ?></div>
      </div>
    </td>
    <td>
      <div class="summary-card">
        <div class="sc-label">Payments Received</div>
        <div class="sc-value positive"><?= $fmt($totalPaymentsReceived) ?></div>
      </div>
    </td>
    <td>
      <div class="summary-card">
        <div class="sc-label">Outstanding Balance</div>
        <div class="sc-value <?= $outstandingBalance > 0 ? 'negative' : '' ?>"><?= $fmt($outstandingBalance) ?></div>
      </div>
    </td>
    <td>
      <div class="summary-card">
        <div class="sc-label">Adjustments</div>
        <div class="sc-value muted"><?= $fmt($totalAdjustments) ?></div>
      </div>
    </td>
    <td>
      <div class="summary-card">
        <div class="sc-label">Collection Rate</div>
        <div class="sc-value <?= $collectionRate >= 80 ? 'positive' : ($collectionRate >= 50 ? 'neutral' : 'negative') ?>"><?= $fmtPct($collectionRate) ?></div>
      </div>
    </td>
  </tr>
</table>

<hr class="divider-thin"/>

<!-- ═══════════════ PAYMENT METHOD BREAKDOWN ═══════════════ -->
<div class="section-title">Payment Method Breakdown</div>
<?php if (empty($methodBreakdown)): ?>
  <p class="empty-msg">No payment records in the selected period.</p>
<?php else: ?>
<table class="data-table no-break">
  <thead>
    <tr>
      <th style="width:50%">Method</th>
      <th class="r" style="width:20%">Transactions</th>
      <th class="r" style="width:30%">Total Amount</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($methodBreakdown as $row): ?>
    <tr>
      <td><?= esc($row['method']) ?></td>
      <td class="r"><?= (int) $row['count'] ?></td>
      <td class="r"><?= $fmt((float) $row['total']) ?></td>
    </tr>
    <?php endforeach; ?>
  </tbody>
  <tfoot>
    <tr>
      <td>Total</td>
      <td class="r"><?= array_sum(array_column($methodBreakdown, 'count')) ?></td>
      <td class="r"><?= $fmt(array_sum(array_column($methodBreakdown, 'total'))) ?></td>
    </tr>
  </tfoot>
</table>
<?php endif; ?>

<hr class="divider-thin"/>

<!-- ═══════════════ CHARGES SUMMARY ═══════════════ -->
<div class="section-title">Charges Summary (Expected Fees by Category)</div>
<?php if (empty($chargesSummary)): ?>
  <p class="empty-msg">No charges in the selected period.</p>
<?php else: ?>
<table class="data-table no-break">
  <thead>
    <tr>
      <th style="width:70%">Category</th>
      <th class="r" style="width:30%">Total Charged</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($chargesSummary as $row): ?>
    <tr>
      <td><?= esc($row['category']) ?></td>
      <td class="r"><?= $fmt((float) $row['total']) ?></td>
    </tr>
    <?php endforeach; ?>
  </tbody>
  <tfoot>
    <tr>
      <td>Total Expected Fees</td>
      <td class="r"><?= $fmt(array_sum(array_column($chargesSummary, 'total'))) ?></td>
    </tr>
  </tfoot>
</table>
<?php endif; ?>

<hr class="divider-thin"/>

<!-- ═══════════════ DETAILED TRANSACTIONS ═══════════════ -->
<div class="section-title">Detailed Transactions</div>
<?php if (!empty($isTruncated)): ?>
  <p class="empty-msg" style="color:#c0392b; background:#fdecea; padding:8px 12px; border-left:4px solid #c0392b;">
    <strong>Note:</strong> Showing <?= count($transactions) ?> of <?= (int) $totalTransactionCount ?> transactions.
    The full dataset is too large for PDF generation. Use the web dashboard for complete records or narrow your date range.
  </p>
<?php endif; ?>
<?php if (empty($transactions)): ?>
  <p class="empty-msg">No payment transactions in the selected period.</p>
<?php else: ?>
<table class="data-table">
  <thead>
    <tr>
      <th style="width:9%">Date</th>
      <th style="width:22%">Student</th>
      <th style="width:13%">Class</th>
      <th class="r" style="width:12%">Amount</th>
      <th class="r" style="width:10%">Original</th>
      <th style="width:13%">Method</th>
      <th style="width:14%">Category</th>
      <th style="width:17%">Receipt #</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($transactions as $tx): ?>
    <tr<?= !empty($tx['isVoided']) ? ' class="voided-row"' : '' ?>>
      <td class="muted"><?= esc(date('d M Y', strtotime($tx['date']))) ?></td>
      <td><?= esc($tx['studentName']) ?></td>
      <td class="muted"><?= esc($tx['className'] ?? '—') ?></td>
      <td class="r"><?= $fmt((float) $tx['amount']) ?></td>
      <td class="r"><?= ($tx['currencyCode'] && $tx['originalAmount'] !== null) ? $fmtOrig((float) $tx['originalAmount'], $tx['currencyCode']) : '—' ?></td>
      <td><?= esc($tx['method']) ?></td>
      <td><?= esc($tx['category']) ?></td>
      <td class="muted">
        <?= esc($tx['receiptNumber'] ?? '—') ?>
        <?php if (!empty($tx['isVoided'])): ?>
          <span class="voided-badge" style="text-decoration:none;">VOID</span>
        <?php endif; ?>
      </td>
    </tr>
    <?php endforeach; ?>
  </tbody>
  <tfoot>
    <tr>
      <td colspan="3">Total (non-voided)</td>
      <td class="r"><?= $fmt(array_sum(array_map(fn($t) => empty($t['isVoided']) ? (float) $t['amount'] : 0, $transactions))) ?></td>
      <td colspan="2"></td>
    </tr>
  </tfoot>
</table>
<?php endif; ?>

</body>
</html>
