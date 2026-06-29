<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;

/**
 * PaymentFactory
 *
 * Generates payment records for students with realistic patterns.
 * Priority: 90
 */
class PaymentFactory extends AbstractFactory
{
    public function getPriority(): int
    {
        return 90;
    }

    protected function tableName(): string
    {
        return 'payments';
    }

    private array $methods = [
        'Cash'          => 40,
        'Bank Transfer' => 30,
        'EcoCash'       => 20,
        'OneMoney'      => 10,
    ];

    public function make(FactoryContext $context): array
    {
        $faker   = $context->faker;
        $now     = $this->now();
        $method  = $this->weightedRandom($this->methods);
        $amount  = round(mt_rand(30, 300) + mt_rand(0, 99) / 100, 2);
        $year    = (int) date('Y');

        $payDate = date('Y-m-d', strtotime('-' . mt_rand(1, 90) . ' days'));
        $month   = date('Y-m', strtotime($payDate));

        $studentId = !empty($context->studentIds)
            ? $context->studentIds[array_rand($context->studentIds)]
            : null;

        $descriptions = [
            'Cash' => 'Cash payment received at school office',
            'Bank Transfer' => 'Bank transfer payment',
            'EcoCash' => 'EcoCash mobile money payment',
            'OneMoney' => 'OneMoney mobile payment',
        ];

        return [
            'id'               => $this->generateId('pay'),
            'tenant_id'        => $context->tenantId,
            'student_id'       => $studentId,
            'amount'           => $amount,
            'date'             => $payDate,
            'method'           => $method,
            'category'         => 'Tuition',
            'description'      => $descriptions[$method] ?? 'Payment received',
            'route_id'         => null,
            'created_at'       => $now,
            'updated_at'       => $now,
        ];
    }

    /**
     * Create $paymentsPerStudent payments for each student.
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
