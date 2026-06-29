<?php

namespace App\Database\Seeds;

use Faker\Generator as Faker;

/**
 * FactoryContext
 *
 * Shared state passed between factories during a seeding run.
 * Tracks created entity IDs so downstream factories can reference them.
 */
class FactoryContext
{
    public string  $tenantId   = '';
    public array   $classIds   = [];
    public array   $staffIds   = [];
    public array   $studentIds = [];
    public array   $routeIds   = [];
    public Faker   $faker;
    public int     $sequence   = 1;

    /** Grade level IDs keyed by grade number (e.g. 7 => 'gl_..._7') */
    public array $gradeLevelIds = [];

    /** Fee structure from tenant settings */
    public array $feeStructure = [];

    /** Payment categories from tenant settings */
    public array $paymentCategories = [];

    public function __construct(Faker $faker)
    {
        $this->faker = $faker;
    }

    public function nextSequence(): int
    {
        return $this->sequence++;
    }

    public function addClassId(string $id): void
    {
        $this->classIds[] = $id;
    }

    public function addStaffId(string $id): void
    {
        $this->staffIds[] = $id;
    }

    public function addStudentId(string $id): void
    {
        $this->studentIds[] = $id;
    }

    public function addRouteId(string $id): void
    {
        $this->routeIds[] = $id;
    }

    public function randomClassId(): ?string
    {
        if (empty($this->classIds)) {
            return null;
        }
        return $this->classIds[array_rand($this->classIds)];
    }

    public function randomStaffId(): ?string
    {
        if (empty($this->staffIds)) {
            return null;
        }
        return $this->staffIds[array_rand($this->staffIds)];
    }
}
