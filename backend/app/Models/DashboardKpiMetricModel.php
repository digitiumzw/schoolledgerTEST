<?php

namespace App\Models;

use CodeIgniter\Model;

class DashboardKpiMetricModel extends Model
{
    protected $table            = 'dashboard_kpi_metrics';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'tenant_id', 'metric_key', 'metric_value', 'metric_label',
        'period_start', 'period_end', 'computed_at', 'expires_at',
    ];

    public function upsertMetric(string $tenantId, array $metric): void
    {
        $now = date('Y-m-d H:i:s');
        $data = [
            'tenant_id'     => $tenantId,
            'metric_key'    => $metric['metric_key'],
            'metric_value'  => (float) ($metric['metric_value'] ?? 0),
            'metric_label'  => (string) ($metric['metric_label'] ?? (string) ($metric['metric_value'] ?? 0)),
            'period_start'  => $metric['period_start'],
            'period_end'    => $metric['period_end'],
            'computed_at'   => $metric['computed_at'] ?? $now,
            'expires_at'    => $metric['expires_at'] ?? date('Y-m-d H:i:s', strtotime('+5 minutes')),
            'created_at'    => $now,
            'updated_at'    => $now,
        ];

        $builder = $this->db->table($this->table);
        $existing = $builder
            ->select('id')
            ->where('tenant_id', $tenantId)
            ->where('metric_key', $data['metric_key'])
            ->where('period_start', $data['period_start'])
            ->where('period_end', $data['period_end'])
            ->get()
            ->getRowArray();

        if ($existing) {
            unset($data['created_at']);
            $this->update($existing['id'], $data);
            return;
        }

        $this->insert($data);
    }

    public function getLatestForTenant(string $tenantId, array $metricKeys): array
    {
        if (empty($metricKeys)) {
            return [];
        }

        $rows = $this->where('tenant_id', $tenantId)
            ->whereIn('metric_key', $metricKeys)
            ->where('period_start <=', date('Y-m-d'))
            ->orderBy('computed_at', 'DESC')
            ->findAll();

        $latest = [];
        foreach ($rows as $row) {
            if (!isset($latest[$row['metric_key']])) {
                $latest[$row['metric_key']] = $row;
            }
        }

        return $latest;
    }

    public function deleteExpired(string $before): int
    {
        $this->where('expires_at <', $before)->delete();
        return $this->db->affectedRows();
    }
}
