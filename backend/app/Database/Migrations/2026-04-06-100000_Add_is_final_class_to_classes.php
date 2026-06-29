<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds is_final_class column to the classes table.
 *
 * Prior to this migration, isFinalClass() relied solely on next_class_id IS NULL,
 * which conflated two distinct states:
 *   - Intentional graduation/final class (should graduate students)
 *   - Unconfigured class (next_class_id not yet set → should skip with error)
 *
 * The new boolean column lets the application distinguish these states:
 *   is_final_class = 1, next_class_id = NULL  → graduate students
 *   is_final_class = 0, next_class_id = NULL  → skip (unconfigured)
 *   is_final_class = 0, next_class_id = <id>  → promote to next class
 */
class AddIsFinalClassToClasses extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('classes', [
            'is_final_class' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
                'after'      => 'next_class_id',
            ],
        ]);
    }

    public function down(): void
    {
        $this->forge->dropColumn('classes', 'is_final_class');
    }
}
