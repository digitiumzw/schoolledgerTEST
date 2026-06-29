<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;
use App\Database\Seeds\UniqueValueGenerator;

/**
 * UserFactory
 *
 * Generates user accounts per tenant (super_admin, admin, bursar, teacher).
 * Priority: 30
 */
class UserFactory extends AbstractFactory
{
    private UniqueValueGenerator $uniqueValues;
    private string $defaultPassword;

    public function __construct(\CodeIgniter\Database\BaseConnection $db, int $batchSize = 100, string $defaultPassword = '12345678')
    {
        parent::__construct($db, $batchSize);
        $this->uniqueValues    = new UniqueValueGenerator();
        $this->defaultPassword = $defaultPassword;
    }

    public function getPriority(): int
    {
        return 30;
    }

    protected function tableName(): string
    {
        return 'users';
    }

    public function make(FactoryContext $context): array
    {
        // Not used for users — we generate fixed roles instead
        return $this->makeWithRole($context, 'admin');
    }

    private function makeWithRole(FactoryContext $context, string $role): array
    {
        $faker = $context->faker;
        $now   = $this->now();
        $name  = $faker->zimbabweanName();
        $slug  = strtolower(preg_replace('/\s+/', '.', $name));
        $email = $this->uniqueValues->generateEmail($slug);

        return [
            'id'         => $this->generateId('user'),
            'tenant_id'  => $context->tenantId,
            'role'       => $role,
            'email'      => $email,
            'password'   => password_hash($this->defaultPassword, PASSWORD_BCRYPT, ['cost' => 10]),
            'name'       => $name,
            'status'     => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    /**
     * Creates exactly 4 users per tenant: super_admin, admin, bursar, teacher.
     * The $count parameter is used for additional teacher accounts.
     */
    public function createMany(FactoryContext $context, int $count): array
    {
        // Do NOT reset — emails must be globally unique across all tenants

        $roles = ['super_admin', 'admin', 'bursar', 'teacher'];
        // Add extra teachers if count > 4
        for ($i = 4; $i < $count; $i++) {
            $roles[] = 'teacher';
        }

        $rows = [];
        $ids  = [];

        foreach ($roles as $role) {
            $row    = $this->makeWithRole($context, $role);
            $rows[] = $row;
            $ids[]  = $row['id'];
        }

        foreach (array_chunk($rows, $this->batchSize) as $batch) {
            $this->db->table($this->tableName())->insertBatch($batch);
        }

        return $ids;
    }
}
