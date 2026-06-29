<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;

/**
 * GradeLevelFactory
 *
 * Creates grade levels (Grade 7 – Grade 11) per tenant.
 * Priority: 20 (after Tenant, before Users)
 */
class GradeLevelFactory extends AbstractFactory
{
    public function getPriority(): int
    {
        return 20;
    }

    protected function tableName(): string
    {
        return 'grade_levels';
    }

    public function make(FactoryContext $context): array
    {
        $now = $this->now();
        return [
            'id'         => $this->generateId('gl'),
            'tenant_id'  => $context->tenantId,
            'name'       => 'Grade',
            'sort_order' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    /**
     * Creates Grade 7 through Grade 11 (5 levels).
     * Ignores $count — always creates the standard 5 levels.
     * Stores IDs in context->gradeLevelIds[grade_number].
     */
    public function createMany(FactoryContext $context, int $count): array
    {
        $now  = $this->now();
        $ids  = [];
        $rows = [];

        foreach (range(7, 11) as $grade) {
            $id       = $this->generateId('gl');
            $rows[]   = [
                'id'         => $id,
                'tenant_id'  => $context->tenantId,
                'name'       => "Grade {$grade}",
                'sort_order' => $grade - 7,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $ids[]                          = $id;
            $context->gradeLevelIds[$grade] = $id;
        }

        $this->db->table($this->tableName())->insertBatch($rows);
        return $ids;
    }
}
