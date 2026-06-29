<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;
use App\Database\Seeds\UniqueValueGenerator;

/**
 * StudentFactory
 *
 * Generates students with Zimbabwean context data.
 * Priority: 70
 */
class StudentFactory extends AbstractFactory
{
    private UniqueValueGenerator $uniqueValues;

    public function __construct(\CodeIgniter\Database\BaseConnection $db, int $batchSize = 100)
    {
        parent::__construct($db, $batchSize);
        $this->uniqueValues = new UniqueValueGenerator();
    }

    public function getPriority(): int
    {
        return 70;
    }

    protected function tableName(): string
    {
        return 'students';
    }

    private static array $genders = ['male', 'female'];

    public function make(FactoryContext $context): array
    {
        $faker     = $context->faker;
        $now       = $this->now();
        $year      = (int) date('Y');
        $firstName = $faker->zimbabweanFirstName();
        $lastName  = $faker->zimbabweanLastName();
        $gender    = static::$genders[array_rand(static::$genders)];
        $classId   = $context->randomClassId();
        $dob       = date('Y-m-d', strtotime('-' . mt_rand(11, 18) . ' years'));

        $bursaryStatus = $this->weightedRandom(['none' => 70, 'partial' => 20, 'full' => 10]);
        $bursaryPct    = match ($bursaryStatus) {
            'partial' => mt_rand(25, 75),
            'full'    => 100,
            default   => 0,
        };
        $bursaryReason = match ($bursaryStatus) {
            'partial', 'full' => $faker->randomElement([
                'Orphan', 'Single parent household', 'Financial hardship',
                'Academic excellence award', 'Staff child discount',
                'Community leader bursary',
            ]),
            default => null,
        };

        $status = $this->weightedRandom([
            'active'       => 75,
            'inactive'     => 10,
            'graduated'    => 5,
            'transferred'  => 5,
            'dropped_out'  => 5,
        ]);

        $enrollmentYear = $year - mt_rand(0, 2);
        $admNum         = $this->uniqueValues->generateAdmissionNumber($enrollmentYear);

        return [
            'id'                     => $this->generateId('stu'),
            'tenant_id'              => $context->tenantId,
            'first_name'             => $firstName,
            'last_name'              => $lastName,
            'admission_number'       => $admNum,
            'gender'                 => $gender,
            'national_id'            => null,
            'class_id'               => $classId,
            'current_enrollment_id'  => null,
            'date_of_birth'          => $dob,
            'email'                  => null,
            'address'                => $faker->harareAddress(),
            'photo_url'              => null,
            'guardian_name'          => $faker->zimbabweanName(),
            'guardian_phone'         => $faker->zimbabweanPhone(),
            'guardian_email'         => null,
            'guardian_relationship'  => $faker->randomElement(['Father', 'Mother', 'Uncle', 'Aunt', 'Guardian']),
            'guardian2_name'         => null,
            'guardian2_phone'        => null,
            'guardian2_relationship' => null,
            'enrollment_date'        => date('Y-m-d', strtotime("-{$enrollmentYear} years", strtotime("{$enrollmentYear}-01-10"))),
            'status'                 => $status,
            'bursary_status'         => $bursaryStatus,
            'bursary_percentage'     => $bursaryPct,
            'bursary_reason'         => $bursaryReason,
            'created_at'             => $now,
            'updated_at'             => $now,
        ];
    }

    public function createMany(FactoryContext $context, int $count): array
    {
        $this->uniqueValues->reset();
        $ids     = [];
        $pending = [];

        // Distribute students across classes
        $classIds = $context->classIds;
        $perClass = empty($classIds) ? 0 : intdiv($count, count($classIds));
        $extra    = empty($classIds) ? $count : $count % count($classIds);

        $distribution = [];
        foreach ($classIds as $classId) {
            $distribution[$classId] = $perClass;
        }
        // Distribute remainder
        for ($i = 0; $i < $extra; $i++) {
            if (empty($classIds)) break;
            $distribution[$classIds[$i % count($classIds)]]++;
        }

        if (empty($classIds)) {
            // No classes — just create without class assignment
            for ($i = 0; $i < $count; $i++) {
                $row     = $this->make($context);
                $ids[]   = $row['id'];
                $pending[] = $row;
                if (count($pending) >= $this->batchSize) {
                    $this->db->table($this->tableName())->insertBatch($pending);
                    $pending = [];
                }
            }
        } else {
            foreach ($distribution as $classId => $classCount) {
                // Temporarily set the class for this batch
                $origClasses       = $context->classIds;
                $context->classIds = [$classId];
                for ($i = 0; $i < $classCount; $i++) {
                    $row     = $this->make($context);
                    $ids[]   = $row['id'];
                    $pending[] = $row;
                    if (count($pending) >= $this->batchSize) {
                        $this->db->table($this->tableName())->insertBatch($pending);
                        $pending = [];
                    }
                }
                $context->classIds = $origClasses;
            }
        }

        if (!empty($pending)) {
            $this->db->table($this->tableName())->insertBatch($pending);
        }

        foreach ($ids as $id) {
            $context->addStudentId($id);
        }

        return $ids;
    }
}
