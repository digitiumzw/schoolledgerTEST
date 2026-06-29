<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;

/**
 * TransportAssignmentFactory
 *
 * Seeds transport_student_allocations for 20-30% of students.
 * Priority: 110
 */
class TransportAssignmentFactory extends AbstractFactory
{
    public function getPriority(): int
    {
        return 110;
    }

    protected function tableName(): string
    {
        return 'transport_student_allocations';
    }

    public function make(FactoryContext $context): array
    {
        $now      = $this->now();
        $studentId = !empty($context->studentIds)
            ? $context->studentIds[array_rand($context->studentIds)]
            : null;
        $routeId = !empty($context->routeIds)
            ? $context->routeIds[array_rand($context->routeIds)]
            : null;

        $year         = date('Y');
        $academicYear = $year . '/' . ($year + 1);

        return [
            'id'            => $this->generateId('tsa'),
            'tenant_id'     => $context->tenantId,
            'student_id'    => $studentId,
            'route_id'      => $routeId,
            'stop_id'       => null,
            'direction'     => 'both',
            'academic_year' => $academicYear,
            'start_date'    => date('Y-m-d', strtotime('-' . mt_rand(10, 90) . ' days')),
            'end_date'      => null,
            'status'        => 'active',
            'notes'         => null,
            'created_at'    => $now,
            'updated_at'    => $now,
        ];
    }

    /**
     * Assigns 20-30% of students to routes. $count is ignored.
     */
    public function createMany(FactoryContext $context, int $count): array
    {
        if (empty($context->studentIds) || empty($context->routeIds)) {
            return [];
        }

        $year         = date('Y');
        $academicYear = $year . '/' . ($year + 1);

        $ids         = [];
        $pending     = [];
        $toAssign    = (int) round(count($context->studentIds) * (mt_rand(20, 30) / 100));
        $studentPool = $context->studentIds;
        shuffle($studentPool);
        $selected    = array_slice($studentPool, 0, $toAssign);

        foreach ($selected as $studentId) {
            $routeId = $context->routeIds[array_rand($context->routeIds)];
            $now     = $this->now();

            $row = [
                'id'            => $this->generateId('tsa'),
                'tenant_id'     => $context->tenantId,
                'student_id'    => $studentId,
                'route_id'      => $routeId,
                'stop_id'       => null,
                'direction'     => 'both',
                'academic_year' => $academicYear,
                'start_date'    => date('Y-m-d', strtotime('-' . mt_rand(10, 90) . ' days')),
                'end_date'      => null,
                'status'        => 'active',
                'notes'         => null,
                'created_at'    => $now,
                'updated_at'    => $now,
            ];

            $ids[]     = $row['id'];
            $pending[] = $row;

            if (count($pending) >= $this->batchSize) {
                $this->db->table($this->tableName())->insertBatch($pending);
                $pending = [];
            }
        }

        if (!empty($pending)) {
            $this->db->table($this->tableName())->insertBatch($pending);
        }

        return $ids;
    }
}
