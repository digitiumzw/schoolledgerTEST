<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

class Seeder extends BaseConfig
{
    /**
     * Default seeding parameters
     */
    public array $defaults = [
        'tenantCount'              => 1,
        'usersPerTenant'           => 4,
        'staffPerTenant'           => 8,
        'classesPerTenant'         => 5,
        'studentsPerClass'         => 10,
        'chargesPerStudent'        => 2,
        'paymentsPerStudent'       => 1,
        'transportRoutesPerTenant' => 2,
        'attendanceDays'           => 30,
        'mode'                     => 'fresh',
        'scenario'                 => null,
    ];

    /**
     * Faker locale for data generation
     */
    public string $fakerLocale = 'en_ZW';

    /**
     * Default password for seeded users (will be bcrypt-hashed)
     */
    public string $defaultPassword = '12345678';

    /**
     * Records per batch insert (balance memory vs. performance)
     */
    public int $batchSize = 100;
}
