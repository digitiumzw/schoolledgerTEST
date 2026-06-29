<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;
use App\Database\Seeds\UniqueValueGenerator;

/**
 * StaffFactory
 *
 * Generates staff members with Zimbabwean context data.
 * Priority: 40
 */
class StaffFactory extends AbstractFactory
{
    private UniqueValueGenerator $uniqueValues;

    public function __construct(\CodeIgniter\Database\BaseConnection $db, int $batchSize = 100)
    {
        parent::__construct($db, $batchSize);
        $this->uniqueValues = new UniqueValueGenerator();
    }

    public function getPriority(): int
    {
        return 40;
    }

    protected function tableName(): string
    {
        return 'staff';
    }

    public function make(FactoryContext $context): array
    {
        $faker      = $context->faker;
        $now        = $this->now();
        $seq        = $context->nextSequence();
        $firstName  = $faker->zimbabweanFirstName();
        $lastName   = $faker->zimbabweanLastName();
        $isTeaching = mt_rand(1, 10) <= 6; // 60% teaching staff

        $hireDate  = date('Y-m-d', strtotime('-' . mt_rand(6, 120) . ' months'));
        $dob       = date('Y-m-d', strtotime('-' . mt_rand(25, 55) . ' years'));
        $email     = $this->uniqueValues->generateEmail(
            strtolower($firstName . '.' . $lastName),
            'staff.edu'
        );
        $employeeId = $this->uniqueValues->generateEmployeeId();

        return [
            'id'                      => $this->generateId('staff'),
            'tenant_id'               => $context->tenantId,
            'first_name'              => $firstName,
            'last_name'               => $lastName,
            'email'                   => $email,
            'phone'                   => $faker->zimbabweanPhone(),
            'address'                 => $faker->harareAddress(),
            'position'                => $faker->schoolPosition(),
            'department'              => $faker->department(),
            'is_teaching'             => $isTeaching ? 1 : 0,
            'employee_id'             => $employeeId,
            'hire_date'               => $hireDate,
            'date_of_birth'           => $dob,
            'employment_status'       => $this->weightedRandom(['active' => 80, 'inactive' => 10, 'on_leave' => 10]),
            'next_of_kin_name'        => $faker->zimbabweanName(),
            'next_of_kin_relationship'=> $faker->randomElement(['Spouse', 'Parent', 'Sibling', 'Child']),
            'next_of_kin_phone'       => $faker->zimbabweanPhone(),
            'next_of_kin_email'       => null,
            'next_of_kin_address'     => $faker->harareAddress(),
            'created_at'              => $now,
            'updated_at'              => $now,
        ];
    }

    public function createMany(FactoryContext $context, int $count): array
    {
        // Do NOT reset — employee_id has a global unique constraint across tenants
        $ids     = [];
        $pending = [];

        for ($i = 0; $i < $count; $i++) {
            $row     = $this->make($context);
            $ids[]   = $row['id'];
            $pending[] = $row;

            if (count($pending) >= $this->batchSize) {
                $this->db->table($this->tableName())->insertBatch($pending);
                $pending = [];
            }
        }

        if (!empty($pending)) {
            $this->db->table($this->tableName())->insertBatch($pending);
        }

        // Track all staff IDs for class assignment
        foreach ($ids as $id) {
            $context->addStaffId($id);
        }

        return $ids;
    }
}
