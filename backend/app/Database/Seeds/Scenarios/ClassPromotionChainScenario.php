<?php

namespace App\Database\Seeds\Scenarios;

/**
 * ClassPromotionChainScenario
 *
 * Creates a complete promotion chain for testing class promotion logic:
 * - Exactly 5 classes (one per grade: 7 → 8 → 9 → 10 → 11)
 * - Grade 11 is marked as is_final_class = true
 * - Students distributed evenly across all grades
 * - next_class_id links form a complete chain
 */
class ClassPromotionChainScenario extends AbstractScenario
{
    public function name(): string
    {
        return 'class-promotion-chain';
    }

    public function description(): string
    {
        return 'Complete promotion chain (Grade 7→11) for testing class promotion workflows';
    }

    public function configure(array &$config): void
    {
        // Exactly 5 classes — one per grade level
        $config['classesPerTenant'] = 5;
        // Distribute students evenly
        $config['studentsPerClass'] = 10;
    }
}
