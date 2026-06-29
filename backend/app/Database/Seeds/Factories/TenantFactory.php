<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;
use App\Database\Seeds\UniqueValueGenerator;

/**
 * TenantFactory
 *
 * Generates tenant (school) records with settings, fee structure,
 * payment categories, and academic calendar.
 * Priority: 10 (created first)
 */
class TenantFactory extends AbstractFactory
{
    private UniqueValueGenerator $uniqueValues;
    private array $usedSchoolNames = [];

    public function __construct(\CodeIgniter\Database\BaseConnection $db, int $batchSize = 100)
    {
        parent::__construct($db, $batchSize);
        $this->uniqueValues = new UniqueValueGenerator();
    }

    public function getPriority(): int
    {
        return 10;
    }

    protected function tableName(): string
    {
        return 'tenants';
    }

    public function make(FactoryContext $context): array
    {
        $faker       = $context->faker;
        $now         = $this->now();
        $currentYear = (int) date('Y');
        $prevYear    = $currentYear - 1;

        // Generate unique school name
        do {
            $schoolName = $faker->schoolName();
        } while (in_array($schoolName, $this->usedSchoolNames, true));
        $this->usedSchoolNames[] = $schoolName;

        $slug        = strtolower(preg_replace('/[^a-z0-9]/i', '-', $schoolName));
        $domain      = "{$slug}.edu";
        $id          = $this->generateId('tenant');
        $termId      = "{$currentYear}-TERM-1";
        $billingRunId = "billing_{$currentYear}_term_1";
        $dueDate     = date('Y-m-d', mktime(0, 0, 0, 2, 10, $currentYear));

        $feeStructure = [
            'structureType'  => 'termly',
            'termsPerYear'   => 3,
            'academicYear'   => (string) $currentYear,
            'defaultFees'    => [
                'Tuition'          => 250,
                'Development Levy' => 50,
                'Sports Fee'       => 30,
                'Computer Levy'    => 25,
            ],
            'classOverrides' => [],
        ];

        $paymentCategories = [
            ['id' => "cat_{$id}_tuition",   'name' => 'Tuition',           'defaultAmount' => 250.00, 'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
            ['id' => "cat_{$id}_devlevy",   'name' => 'Development Levy',  'defaultAmount' => 50.00,  'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
            ['id' => "cat_{$id}_sports",    'name' => 'Sports Fee',        'defaultAmount' => 30.00,  'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
            ['id' => "cat_{$id}_computer",  'name' => 'Computer Levy',     'defaultAmount' => 25.00,  'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
            ['id' => "cat_{$id}_transport", 'name' => 'Transport Fee',     'defaultAmount' => null,   'active' => true,  'createdAt' => $now, 'updatedAt' => $now],
        ];

        $academicCalendar = [
            'terms' => [
                ['id' => "{$currentYear}-TERM-1", 'name' => 'Term 1', 'start' => "{$currentYear}-01-10", 'end' => "{$currentYear}-04-05", 'displayLabel' => "Term 1 {$currentYear}"],
                ['id' => "{$currentYear}-TERM-2", 'name' => 'Term 2', 'start' => "{$currentYear}-05-01", 'end' => "{$currentYear}-07-25", 'displayLabel' => "Term 2 {$currentYear}"],
                ['id' => "{$currentYear}-TERM-3", 'name' => 'Term 3', 'start' => "{$currentYear}-08-10", 'end' => "{$currentYear}-11-20", 'displayLabel' => "Term 3 {$currentYear}"],
            ],
            'schoolOpen'                  => true,
            'disableAttendanceWhenClosed' => true,
        ];

        $settings = [
            'schoolName'        => $schoolName,
            'contactEmail'      => "info@{$domain}",
            'contactPhone'      => $faker->zimbabweanPhone(),
            'address'           => $faker->harareAddress(),
            'defaultCurrency'   => 'USD',
            'academicYear'      => (string) $currentYear,
            'staffWorkHours'    => ['startTime' => '08:00', 'endTime' => '17:00'],
            'studentWorkHours'  => ['startTime' => '08:00', 'endTime' => '15:30'],
        ];

        // Store fee structure on context for child factories
        $context->feeStructure       = $feeStructure;
        $context->paymentCategories  = $paymentCategories;

        return [
            'id'                        => $id,
            'charge_generation_history' => json_encode([]),
            'settings'                  => json_encode($settings),
            'fee_structure'             => json_encode($feeStructure),
            'payment_categories'        => json_encode($paymentCategories),
            'academic_calendar'         => json_encode($academicCalendar),
            'created_at'                => $now,
            'updated_at'                => $now,
        ];
    }

    /**
     * Override createMany to update context.tenantId after each tenant creation.
     * Since this factory creates one tenant at a time and the orchestrator
     * calls it per tenant, the single-tenant path is the common case.
     */
    public function createMany(FactoryContext $context, int $count): array
    {
        $ids = [];
        for ($i = 0; $i < $count; $i++) {
            $row = $this->make($context);
            $this->db->table($this->tableName())->insert($row);
            $context->tenantId = $row['id'];
            $ids[]             = $row['id'];
        }
        return $ids;
    }
}
