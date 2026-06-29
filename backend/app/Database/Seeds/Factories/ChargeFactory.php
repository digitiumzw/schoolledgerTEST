<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;

/**
 * ChargeFactory
 *
 * Generates charges/fees for students.
 * Priority: 80
 */
class ChargeFactory extends AbstractFactory
{
    public function getPriority(): int
    {
        return 80;
    }

    protected function tableName(): string
    {
        return 'charges';
    }

    /** Fee categories with relative weights */
    private array $categoryWeights = [
        'Tuition'          => 60,
        'Development Levy' => 20,
        'Sports Fee'       => 10,
        'Computer Levy'    => 10,
    ];

    /** Default amounts per category */
    private array $defaultAmounts = [
        'Tuition'          => 250.00,
        'Development Levy' => 50.00,
        'Sports Fee'       => 30.00,
        'Computer Levy'    => 25.00,
    ];

    public function make(FactoryContext $context): array
    {
        $faker     = $context->faker;
        $now       = $this->now();
        $year      = (int) date('Y');
        $termId    = "T1_{$year}";

        $category = $this->weightedRandom($this->categoryWeights);
        $amount   = $this->defaultAmounts[$category] ?? 50.00;
        // Small variation ±10%
        $amount   = round($amount * (1 + (mt_rand(-10, 10) / 100)), 2);

        $status = $this->weightedRandom([
            'paid'    => 40,
            'partial' => 35,
            'pending' => 20,
            'overdue' => 5,
        ]);

        $dateGenerated = date('Y-m-d', strtotime('-' . mt_rand(10, 90) . ' days'));
        $dueDate       = date('Y-m-d', strtotime($dateGenerated . ' + 30 days'));

        $studentId = !empty($context->studentIds)
            ? $context->studentIds[array_rand($context->studentIds)]
            : null;

        return [
            'id'                  => $this->generateId('chg'),
            'tenant_id'           => $context->tenantId,
            'student_id'          => $studentId,
            'category'            => $category,
            'charge_type'         => 'fee_structure',
            'status'              => $status,
            'amount'              => $amount,
            'date_generated'      => $dateGenerated,
            'due_date'            => $dueDate,
            'academic_session'    => ($year - 1) . '/' . $year,
            'term'                => 'Term 1',
            'term_id'             => $termId,
            'academic_year'       => (string) $year,
            'description'         => "{$category} - Term 1 {$year}",
            'generation_batch_id' => null,
            'created_by'          => null,
            'deleted_at'          => null,
            'route_id'            => null,
            'billing_run_id'      => null,
            'created_at'          => $now,
            'updated_at'          => $now,
        ];
    }

    /**
     * Create $chargesPerStudent charges for each student.
     */
    public function createMany(FactoryContext $context, int $count): array
    {
        $ids     = [];
        $pending = [];

        foreach ($context->studentIds as $studentId) {
            for ($i = 0; $i < $count; $i++) {
                $row               = $this->make($context);
                $row['student_id'] = $studentId;
                $ids[]             = $row['id'];
                $pending[]         = $row;

                if (count($pending) >= $this->batchSize) {
                    $this->db->table($this->tableName())->insertBatch($pending);
                    $pending = [];
                }
            }
        }

        if (!empty($pending)) {
            $this->db->table($this->tableName())->insertBatch($pending);
        }

        return $ids;
    }
}
