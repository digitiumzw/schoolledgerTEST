<?php

namespace App\Database\Seeds;

/**
 * EntityFactoryInterface
 *
 * Contract that every entity factory must implement.
 */
interface EntityFactoryInterface
{
    /**
     * Generate a single entity as an associative array (not persisted).
     */
    public function make(FactoryContext $context): array;

    /**
     * Generate $count entities and persist them to the database.
     * Returns an array of created IDs.
     */
    public function createMany(FactoryContext $context, int $count): array;

    /**
     * Priority determines creation order (lower = created first).
     */
    public function getPriority(): int;
}
