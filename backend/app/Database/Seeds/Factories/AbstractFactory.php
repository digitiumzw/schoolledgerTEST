<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\EntityFactoryInterface;
use App\Database\Seeds\FactoryContext;
use CodeIgniter\Database\BaseConnection;
use CodeIgniter\CLI\CLI;

/**
 * AbstractFactory
 *
 * Base class for all entity factories. Provides:
 * - Batch insert support (memory-efficient for large datasets)
 * - Progress output via CodeIgniter CLI
 * - createMany() default implementation
 */
abstract class AbstractFactory implements EntityFactoryInterface
{
    protected BaseConnection $db;
    protected int $batchSize;

    public function __construct(BaseConnection $db, int $batchSize = 100)
    {
        $this->db        = $db;
        $this->batchSize = $batchSize;
    }

    /**
     * Sub-classes must implement make() to return one row of data.
     */
    abstract public function make(FactoryContext $context): array;

    /**
     * Table name to insert into.
     */
    abstract protected function tableName(): string;

    /**
     * Create $count records and persist in batches.
     * Returns array of created IDs.
     */
    public function createMany(FactoryContext $context, int $count): array
    {
        $ids     = [];
        $pending = [];

        for ($i = 0; $i < $count; $i++) {
            $row  = $this->make($context);
            $ids[] = $row['id'];
            $pending[] = $row;

            if (count($pending) >= $this->batchSize) {
                $this->db->table($this->tableName())->insertBatch($pending);
                $pending = [];
            }
        }

        if (!empty($pending)) {
            $this->db->table($this->tableName())->insertBatch($pending);
        }

        return $ids;
    }

    /**
     * Generate a UUID-style ID prefixed by entity type.
     */
    protected function generateId(string $prefix = 'ent'): string
    {
        return $prefix . '_' . bin2hex(random_bytes(8));
    }

    /**
     * Current timestamp for created_at / updated_at.
     */
    protected function now(): string
    {
        return date('Y-m-d H:i:s');
    }

    /**
     * Weighted random pick from options.
     * $weights is an associative array [value => weight].
     */
    protected function weightedRandom(array $weights): mixed
    {
        $rand = mt_rand(1, array_sum($weights));
        foreach ($weights as $value => $weight) {
            if ($rand <= $weight) {
                return $value;
            }
            $rand -= $weight;
        }
        return array_key_first($weights);
    }
}
