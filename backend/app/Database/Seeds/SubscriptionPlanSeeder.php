<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SubscriptionPlanSeeder extends Seeder
{
    public function run()
    {
        $now = date('Y-m-d H:i:s');

        $plans = [
            [
                'id'                   => 'starter',
                'name'                 => 'Starter',
                'description'          => 'For schools with fewer than 250 students',
                'max_students'         => 249,
                'monthly_price_cents'  => 1500,
                'annual_price_cents'   => 15000,
                'currency'             => 'USD',
                'is_active'            => 1,
                'sort_order'           => 1,
                'created_at'           => $now,
                'updated_at'           => $now,
            ],
            [
                'id'                   => 'growth',
                'name'                 => 'Growth',
                'description'          => 'For schools with fewer than 350 students',
                'max_students'         => 349,
                'monthly_price_cents'  => 2500,
                'annual_price_cents'   => 25000,
                'currency'             => 'USD',
                'is_active'            => 1,
                'sort_order'           => 2,
                'created_at'           => $now,
                'updated_at'           => $now,
            ],
            [
                'id'                   => 'enterprise',
                'name'                 => 'Enterprise',
                'description'          => 'For schools with 350 or more students',
                'max_students'         => null,
                'monthly_price_cents'  => 4000,
                'annual_price_cents'   => 40000,
                'currency'             => 'USD',
                'is_active'            => 1,
                'sort_order'           => 3,
                'created_at'           => $now,
                'updated_at'           => $now,
            ],
        ];

        // Ensure the free plan is deactivated if it exists from a prior seed
        $this->db->table('subscription_plans')
            ->where('id', 'free')
            ->update(['is_active' => 0, 'updated_at' => $now]);

        foreach ($plans as $plan) {
            $existing = $this->db->table('subscription_plans')
                ->where('id', $plan['id'])
                ->countAllResults();

            if ($existing === 0) {
                $this->db->table('subscription_plans')->insert($plan);
            } else {
                $this->db->table('subscription_plans')
                    ->where('id', $plan['id'])
                    ->update([
                        'name'                => $plan['name'],
                        'description'         => $plan['description'],
                        'max_students'        => $plan['max_students'],
                        'monthly_price_cents' => $plan['monthly_price_cents'],
                        'annual_price_cents'  => $plan['annual_price_cents'],
                        'is_active'           => 1,
                        'sort_order'          => $plan['sort_order'],
                        'updated_at'          => $now,
                    ]);
            }
        }
    }
}
