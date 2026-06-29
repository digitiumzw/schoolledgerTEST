<?php
  $routeName    = $route['route_name'] ?? 'Unnamed Route';
  $routeStatus  = $route['status'] ?? 'unknown';
  $monthlyFee   = (float) ($route['monthly_fee'] ?? 0);
  $totalStudents = count($students);
  $stopCount     = count($stops);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { margin: 0; size: A4 portrait; }
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; }

  .page { padding: 44px 52px 48px; }

  /* ── Header ── */
  .hdr-tbl { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .hdr-tbl td { vertical-align: middle; }
  .school-name  { font-size: 19px; font-weight: 700; color: #1e3a8a; }
  .report-title { font-size: 26px; font-weight: 700; color: #111827; letter-spacing: 1px; text-transform: uppercase; text-align: right; }
  .report-date  { font-size: 10.5px; color: #6b7280; text-align: right; margin-top: 3px; }

  .rule-thick { border: none; border-top: 2px solid #1e3a8a; margin: 12px 0 16px; }
  .rule-light { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }

  /* ── Route title row ── */
  .route-name  { font-size: 17px; font-weight: 700; color: #111827; }
  .status-pill { display: inline-block; padding: 2px 10px; border-radius: 20px;
                 font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
  .pill-active   { background: #dcfce7; color: #166534; }
  .pill-inactive { background: #fee2e2; color: #991b1b; }
  .fee-text    { font-size: 11px; color: #6b7280; margin-left: 8px; }

  /* ── Info cards ── */
  .cards-tbl   { width: 100%; border-collapse: separate; border-spacing: 0; margin: 14px 0 16px; }
  .info-card   { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
                 padding: 11px 14px; vertical-align: top; }
  .card-gap    { width: 10px; }
  .card-lbl    { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 5px; }
  .card-main   { font-size: 13px; font-weight: 700; color: #111827; }
  .card-sub    { font-size: 10.5px; color: #6b7280; margin-top: 2px; }

  /* ── Stats bar ── */
  .stats-bar { background: #1e3a8a; border-radius: 6px; overflow: hidden; margin-bottom: 20px; }
  .stats-tbl { width: 100%; border-collapse: collapse; }
  .stat-cell  { padding: 11px 10px; text-align: center; border-right: 1px solid rgba(255,255,255,0.12); }
  .stat-cell:last-child { border-right: none; }
  .stat-num   { font-size: 18px; font-weight: 700; color: #fff; }
  .stat-lbl   { font-size: 9px; color: rgba(255,255,255,0.65); text-transform: uppercase;
                letter-spacing: 0.5px; margin-top: 2px; }

  /* ── Stops section ── */
  .section-hdr { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase;
                 letter-spacing: 0.7px; margin-bottom: 8px; }
  .stops-tbl   { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  .stops-tbl td { font-size: 11.5px; padding: 4px 8px; color: #374151;
                  border-bottom: 1px solid #f3f4f6; }
  .stop-num    { color: #d1d5db; width: 22px; text-align: right; font-size: 10px; }
  .stop-dot    { width: 10px; color: #1e3a8a; text-align: center; }
  .stop-time   { color: #9ca3af; text-align: right; font-size: 10.5px; width: 70px; }

  /* ── Student table ── */
  .student-tbl { width: 100%; border-collapse: collapse; }
  .student-tbl thead tr { background: #111827; }
  .student-tbl th { font-size: 9.5px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.5px; color: #fff; padding: 9px 9px; text-align: left; }
  .student-tbl th.r { text-align: right; }
  .student-tbl tbody tr:nth-child(even) { background: #f9fafb; }
  .student-tbl td  { font-size: 11.5px; color: #374151; padding: 7px 9px;
                     border-bottom: 1px solid #f1f5f9; }
  .td-num      { color: #d1d5db; font-size: 10px; text-align: right; width: 22px; }
  .td-name     { font-weight: 600; color: #111827; }
  .td-r        { text-align: right; }
  .td-bal-pos  { text-align: right; color: #b45309; font-weight: 700; }
  .td-bal-paid { text-align: right; color: #16a34a; font-weight: 600; }
  .td-bal-na   { text-align: right; color: #d1d5db; }
  .dir-pill    { display: inline-block; background: #eff6ff; color: #1e40af;
                 border-radius: 20px; padding: 1px 8px; font-size: 9.5px; font-weight: 700; }

  .no-students { text-align: center; padding: 28px 0; color: #9ca3af; font-size: 12px;
                 font-style: italic; }

  /* ── Footer ── */
  .footer      { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  .ftr-tbl     { width: 100%; border-collapse: collapse; }
  .ftr-tbl td  { font-size: 9.5px; color: #9ca3af; vertical-align: middle; }
  .ftr-tbl td.fr { text-align: right; }

  /* ── Powered-by ── */
  .powered-by  { margin-top: 10px; text-align: center; }
  .pb-inner    { display: inline-block; }
  .pb-logo     { height: 18px; vertical-align: middle; margin-right: 5px; }
  .pb-text     { font-size: 8.5px; color: #9ca3af; vertical-align: middle; letter-spacing: 0.3px; }
</style>
</head>
<body>
<div class="page">

  <!-- ══════════════ HEADER ══════════════ -->
  <table class="hdr-tbl">
    <tr>
      <td style="width:55%">
        <?php if (!empty($logoDataUri)): ?>
          <img src="<?= $logoDataUri ?>" alt="Logo" style="height:40px;margin-bottom:4px;display:block;">
        <?php endif; ?>
        <div class="school-name"><?= esc($schoolName) ?></div>
      </td>
      <td style="width:45%">
        <div class="report-title">Route Report</div>
        <div class="report-date">Generated <?= esc($generatedAt) ?></div>
      </td>
    </tr>
  </table>
  <hr class="rule-thick"/>

  <!-- ══════════════ ROUTE TITLE ══════════════ -->
  <table style="width:100%;margin-bottom:4px;">
    <tr>
      <td>
        <div class="route-name"><?= esc($routeName) ?></div>
        <div style="margin-top:5px;">
          <span class="status-pill <?= $routeStatus === 'active' ? 'pill-active' : 'pill-inactive' ?>">
            <?= ucfirst(esc($routeStatus)) ?>
          </span>
          <span class="fee-text">$<?= number_format($monthlyFee, 2) ?> / month</span>
        </div>
      </td>
    </tr>
  </table>

  <!-- ══════════════ INFO CARDS ══════════════ -->
  <table class="cards-tbl">
    <tr>
      <!-- Vehicle -->
      <td class="info-card" style="width:31%">
        <div class="card-lbl">Vehicle</div>
        <?php if ($period && !empty($period['vehicle_name'])): ?>
          <div class="card-main"><?= esc($period['vehicle_name']) ?></div>
          <?php if (!empty($period['reg_number'])): ?>
            <div class="card-sub"><?= esc($period['reg_number']) ?></div>
          <?php endif; ?>
          <?php if (!empty($period['vehicle_type'])): ?>
            <div class="card-sub"><?= ucfirst(esc($period['vehicle_type'])) ?> &middot; <?= (int)($period['capacity'] ?? 0) ?> seats</div>
          <?php endif; ?>
        <?php else: ?>
          <div class="card-sub" style="font-style:italic;color:#d1d5db;">Not assigned</div>
        <?php endif; ?>
      </td>
      <td class="card-gap"></td>

      <!-- Driver -->
      <td class="info-card" style="width:31%">
        <div class="card-lbl">Driver</div>
        <?php if ($period && !empty($period['driver_name'])): ?>
          <div class="card-main"><?= esc($period['driver_name']) ?></div>
          <?php if (!empty($period['driver_phone'])): ?>
            <div class="card-sub"><?= esc($period['driver_phone']) ?></div>
          <?php endif; ?>
        <?php else: ?>
          <div class="card-sub" style="font-style:italic;color:#d1d5db;">Not assigned</div>
        <?php endif; ?>
      </td>
      <td class="card-gap"></td>

      <!-- Stops -->
      <td class="info-card" style="width:31%">
        <div class="card-lbl">Stops</div>
        <div class="card-main"><?= $stopCount ?> stop<?= $stopCount !== 1 ? 's' : '' ?></div>
        <?php if ($stopCount > 0): ?>
          <div class="card-sub">
            <?= esc($stops[0]['name']) ?>
            <?php if ($stopCount > 1): ?>&nbsp;&rarr;&nbsp;<?= esc(end($stops)['name']) ?><?php endif; ?>
          </div>
        <?php endif; ?>
      </td>
    </tr>
  </table>

  <!-- ══════════════ STATS BAR ══════════════ -->
  <div class="stats-bar">
    <table class="stats-tbl">
      <tr>
        <td class="stat-cell">
          <div class="stat-num"><?= $totalStudents ?></div>
          <div class="stat-lbl">Total Students</div>
        </td>
        <td class="stat-cell">
          <div class="stat-num">$<?= number_format($monthlyFee * $totalStudents, 2) ?></div>
          <div class="stat-lbl">Monthly Revenue</div>
        </td>
        <?php if ($includeBalances): ?>
        <td class="stat-cell">
          <div class="stat-num"><?= $studentsWithBalance ?></div>
          <div class="stat-lbl">With Balance</div>
        </td>
        <td class="stat-cell">
          <div class="stat-num">$<?= number_format($totalOutstanding, 2) ?></div>
          <div class="stat-lbl">Total Outstanding</div>
        </td>
        <?php endif; ?>
      </tr>
    </table>
  </div>

  <!-- ══════════════ STOPS LIST ══════════════ -->
  <?php if ($stopCount > 0): ?>
  <div class="section-hdr">Route Stops</div>
  <table class="stops-tbl">
    <?php foreach ($stops as $i => $stop): ?>
    <tr>
      <td class="stop-num"><?= ($i + 1) ?></td>
      <td class="stop-dot">&bull;</td>
      <td><?= esc($stop['name']) ?></td>
      <td class="stop-time"><?= !empty($stop['pickupTime']) ? esc($stop['pickupTime']) : '' ?></td>
    </tr>
    <?php endforeach; ?>
  </table>
  <?php endif; ?>

  <!-- ══════════════ STUDENT LIST ══════════════ -->
  <div class="section-hdr">Students (<?= $totalStudents ?>)</div>
  <?php if (empty($students)): ?>
    <div class="no-students">No students allocated to this route.</div>
  <?php else: ?>
    <?php
      // Column widths adjust based on whether we include the balance column
      $w_name  = $includeBalances ? '30%' : '38%';
      $w_class = $includeBalances ? '18%' : '22%';
      $w_stop  = $includeBalances ? '20%' : '22%';
      $w_dir   = '12%';
      $w_bal   = '14%';
    ?>
  <table class="student-tbl">
    <thead>
      <tr>
        <th style="width:4%">#</th>
        <th style="width:<?= $w_name ?>">Student Name</th>
        <th style="width:<?= $w_class ?>">Class</th>
        <th style="width:<?= $w_stop ?>">Stop</th>
        <th style="width:<?= $w_dir ?>">Direction</th>
        <?php if ($includeBalances): ?>
          <th class="r" style="width:<?= $w_bal ?>">Balance</th>
        <?php endif; ?>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($students as $i => $student): ?>
      <?php
        $bal        = $student['balance'];
        $balClass   = 'td-bal-na';
        $balDisplay = '—';
        if ($bal !== null) {
            if ($bal > 0) {
                $balDisplay = '$' . number_format((float)$bal, 2);
                $balClass   = 'td-bal-pos';
            } else {
                $balDisplay = 'Paid';
                $balClass   = 'td-bal-paid';
            }
        }
      ?>
      <tr>
        <td class="td-num"><?= ($i + 1) ?></td>
        <td class="td-name"><?= esc($student['studentName']) ?></td>
        <td><?= esc($student['studentClass'] ?: '—') ?></td>
        <td><?= esc($student['stopName'] ?: '—') ?></td>
        <td>
          <?php if ($student['direction'] !== 'both'): ?>
            <span class="dir-pill"><?= ucfirst(esc($student['direction'])) ?></span>
          <?php else: ?>
            <span style="color:#9ca3af;font-size:11px;">Both</span>
          <?php endif; ?>
        </td>
        <?php if ($includeBalances): ?>
          <td class="<?= $balClass ?>"><?= $balDisplay ?></td>
        <?php endif; ?>
      </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
  <?php endif; ?>

  <!-- ══════════════ FOOTER ══════════════ -->
  <div class="footer">
    <table class="ftr-tbl">
      <tr>
        <td><?= esc($schoolName) ?> &nbsp;&middot;&nbsp; <?= esc($routeName) ?></td>
        <td class="fr">Generated <?= esc($generatedAt) ?> &nbsp;&middot;&nbsp; Confidential</td>
      </tr>
    </table>
    <div class="powered-by">
      <span class="pb-inner">
        <?php if (!empty($logoDataUri)): ?>
          <img src="<?= $logoDataUri ?>" alt="School Ledger" class="pb-logo">
        <?php endif; ?>
        <span class="pb-text">Powered by School Ledger</span>
      </span>
    </div>
  </div>

</div>
</body>
</html>
