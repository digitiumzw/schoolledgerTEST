<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;

/**
 * ClassFactory
 *
 * Generates class records linked to grade levels and teaching staff.
 * Priority: 50
 */
class ClassFactory extends AbstractFactory
{
    public function getPriority(): int
    {
        return 50;
    }

    protected function tableName(): string
    {
        return 'classes';
    }

    private static array $streams = ['A', 'B', 'C', 'D'];

    public function make(FactoryContext $context): array
    {
        $now          = $this->now();
        $grades       = array_keys($context->gradeLevelIds);
        $grade        = !empty($grades) ? $grades[array_rand($grades)] : 7;
        $gradeLevelId = $context->gradeLevelIds[$grade] ?? null;
        $stream       = static::$streams[array_rand(static::$streams)];
        $teacherId    = $context->randomStaffId();

        return [
            'id'             => $this->generateId('class'),
            'tenant_id'      => $context->tenantId,
            'name'           => "{$grade}{$stream}",
            'grade_level_id' => $gradeLevelId,
            'stream'         => $stream,
            'teacher_id'     => $teacherId,
            'next_class_id'  => null,
            'is_final_class' => 0,
            'capacity'       => mt_rand(30, 45),
            'created_at'     => $now,
            'updated_at'     => $now,
        ];
    }

    public function createMany(FactoryContext $context, int $count): array
    {
        $now     = $this->now();
        $ids     = [];
        $rows    = [];
        $grades  = range(7, 11);
        $streams = static::$streams;

        // Generate one class per grade level to build a promotion chain,
        // then fill remaining slots with extra classes
        $gradeAssignments = [];
        foreach ($grades as $i => $grade) {
            if ($i >= $count) break;
            $gradeAssignments[] = $grade;
        }
        for ($i = count($grades); $i < $count; $i++) {
            $gradeAssignments[] = $grades[$i % count($grades)];
        }

        foreach ($gradeAssignments as $idx => $grade) {
            $stream       = $streams[$idx % count($streams)];
            $gradeLevelId = $context->gradeLevelIds[$grade] ?? null;
            $teacherId    = $context->randomStaffId();
            $id           = $this->generateId('class');

            $rows[] = [
                'id'             => $id,
                'tenant_id'      => $context->tenantId,
                'name'           => "{$grade}{$stream}",
                'grade_level_id' => $gradeLevelId,
                'stream'         => $stream,
                'teacher_id'     => $teacherId,
                'next_class_id'  => null,
                'is_final_class' => ($grade === 11) ? 1 : 0,
                'capacity'       => mt_rand(30, 45),
                'created_at'     => $now,
                'updated_at'     => $now,
            ];
            $ids[]   = $id;
        }

        $this->db->table($this->tableName())->insertBatch($rows);

        // Wire up promotion chain: each grade points to the next
        $this->wirePromotionChain($rows);

        foreach ($ids as $id) {
            $context->addClassId($id);
        }

        return $ids;
    }

    /**
     * After inserting all classes, update next_class_id to form a promotion chain.
     */
    private function wirePromotionChain(array $rows): void
    {
        // Group by grade level name pattern (e.g., "7A" => grade 7)
        $byGrade = [];
        foreach ($rows as $row) {
            if (preg_match('/^(\d+)/', $row['name'], $m)) {
                $byGrade[(int)$m[1]][] = $row['id'];
            }
        }

        ksort($byGrade);
        $grades = array_keys($byGrade);

        foreach ($grades as $i => $grade) {
            if (!isset($grades[$i + 1])) continue;
            $nextGrade   = $grades[$i + 1];
            $nextClassId = $byGrade[$nextGrade][0] ?? null;
            if ($nextClassId === null) continue;

            foreach ($byGrade[$grade] as $classId) {
                $this->db->table('classes')
                    ->where('id', $classId)
                    ->update(['next_class_id' => $nextClassId]);
            }
        }
    }
}
