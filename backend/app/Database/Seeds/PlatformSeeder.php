<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

/**
 * PlatformSeeder
 *
 * Bootstraps the platform control panel with:
 *   1. Initial Owner admin account
 *   2. Default platform settings
 *   3. Subscription plans (Starter, Growth, Enterprise)
 *
 * Safe to run multiple times — all sections are idempotent.
 *
 * Usage:
 *   php spark platform:seed          (via dedicated command)
 *   php spark db:seed PlatformSeeder (via CI4 built-in seeder runner)
 *
 * Default credentials (change immediately after first login):
 *   Email:    admin@schoolledger.io
 *   Password: Admin@1234!
 */
class PlatformSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedPlatformAdmin();
        $this->seedDefaultSettings();
        $this->seedSubscriptionPlans();
    }

    // -------------------------------------------------------------------------
    // 1. Initial platform admin account
    // -------------------------------------------------------------------------

    private function seedPlatformAdmin(): void
    {
        $email = 'admin@localhost.com';

        $existing = $this->db->table('platform_users')
            ->where('email', $email)
            ->get()
            ->getRow();

        if ($existing) {
            echo "  [skip] Platform admin already exists ({$email})\n";
            return;
        }

        $this->db->table('platform_users')->insert([
            'name'          => 'Platform Admin',
            'email'         => $email,
            'password_hash' => password_hash('12345678', PASSWORD_BCRYPT),
            'platform_role' => 'Owner',
            'status'        => 'Active',
            'created_at'    => date('Y-m-d H:i:s'),
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);

        echo "  [ok]   Platform admin created: {$email} / Admin@1234!\n";
        echo "         *** Change this password immediately after first login ***\n";
    }

    // -------------------------------------------------------------------------
    // 2. Default platform settings (insert-only — never overwrites existing)
    // -------------------------------------------------------------------------

    private function seedDefaultSettings(): void
    {
        $defaults = [
            // ── Identity & branding ──────────────────────────────────────────
            ['key' => 'support_email',    'value' => '"support@schoolledger.io"',       'type' => 'string',  'description' => 'Support contact email shown in all outbound emails'],
            ['key' => 'tagline',          'value' => '"School management made simple"', 'type' => 'string',  'description' => 'Platform tagline used in marketing copy'],

            // ── Localisation ─────────────────────────────────────────────────
            ['key' => 'default_currency', 'value' => '"USD"',            'type' => 'string',  'description' => 'Default billing currency (ISO 4217, 3-char code)'],
            ['key' => 'default_timezone', 'value' => '"Africa/Harare"',  'type' => 'string',  'description' => 'Default timezone for all tenants (IANA tz identifier)'],

            // ── Billing & invoicing ───────────────────────────────────────────
            ['key' => 'tax_rate',                           'value' => '0',     'type' => 'number',  'description' => 'Default tax rate applied to invoices (decimal, e.g. 0.15 = 15%)'],
            ['key' => 'trial_length_days',                  'value' => '14',    'type' => 'number',  'description' => 'Default free-trial period in days for new tenants'],
            ['key' => 'invoice_prefix',                     'value' => '"INV-"','type' => 'string',  'description' => 'Prefix prepended to all generated invoice numbers'],
            ['key' => 'auto_suspend_after_failed_payments', 'value' => '3',     'type' => 'number',  'description' => 'Suspend tenant subscription after this many consecutive failed payments'],

            // ── Security & notifications ──────────────────────────────────────
            ['key' => 'weekly_security_digest', 'value' => 'true', 'type' => 'boolean', 'description' => 'Send a weekly security-digest email to platform admins'],

            // ── Payment provider ─────────────────────────────────────────────
            ['key' => 'payment_provider_status', 'value' => '{"connected":false}', 'type' => 'json', 'description' => 'Payment provider OAuth connection status'],

            // ── Email templates ───────────────────────────────────────────────
            ['key' => 'email_template_welcome',               'value' => '{"subject":"Welcome to School Ledger","body":""}',          'type' => 'json', 'description' => 'Welcome email sent when a new school is onboarded'],
            ['key' => 'email_template_trial_ending',          'value' => '{"subject":"Your trial is ending soon","body":""}',         'type' => 'json', 'description' => 'Reminder sent 3 days before trial expires'],
            ['key' => 'email_template_payment_failed',        'value' => '{"subject":"Payment failed","body":""}',                    'type' => 'json', 'description' => 'Alert sent when a subscription payment fails'],
            ['key' => 'email_template_subscription_cancelled','value' => '{"subject":"Subscription cancelled","body":""}',            'type' => 'json', 'description' => 'Confirmation sent when a subscription is cancelled'],
            ['key' => 'email_template_monthly_invoice',       'value' => '{"subject":"Your monthly invoice is ready","body":""}',     'type' => 'json', 'description' => 'Monthly invoice notification email'],

            // ── Maintenance mode ──────────────────────────────────────────────
            ['key' => 'maintenance_mode',     'value' => 'false',                        'type' => 'boolean', 'description' => 'Toggle platform-wide maintenance mode (blocks tenant logins)'],
            ['key' => 'maintenance_headline', 'value' => '"Platform Under Maintenance"', 'type' => 'string',  'description' => 'Headline shown on the maintenance notice page'],
            ['key' => 'maintenance_message',  'value' => '"The platform is currently under maintenance. Service will be restored shortly."', 'type' => 'string', 'description' => 'Body copy shown on the maintenance notice page'],
        ];

        $inserted = 0;
        foreach ($defaults as $setting) {
            $existing = $this->db->table('platform_settings')
                ->where('key', $setting['key'])
                ->get()
                ->getRow();

            if (!$existing) {
                $this->db->table('platform_settings')->insert(array_merge($setting, [
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]));
                $inserted++;
            }
        }

        $total = count($defaults);
        $skipped = $total - $inserted;
        echo "  [ok]   Platform settings: {$inserted} inserted, {$skipped} already present (total {$total})\n";
    }

    // -------------------------------------------------------------------------
    // 3. Subscription plans (upsert — keeps existing customisations unless
    //    a plan is missing entirely, in which case it is created fresh)
    // -------------------------------------------------------------------------

    private function seedSubscriptionPlans(): void
    {
        $now = date('Y-m-d H:i:s');

        $plans = [
            [
                'id'                  => 'starter',
                'name'                => 'Lite',
                'description'         => 'For schools with fewer than 75 students',
                'max_students'        => 249,
                'monthly_price_cents' => 1500,
                'annual_price_cents'  => 15000,
                'annual_discount_pct' => 17.00,
                'currency'            => 'USD',
                'is_active'           => 1,
                'sort_order'          => 1,
            ],
            [
                'id'                  => 'growth',
                'name'                => 'Standard',
                'description'         => 'For schools with fewer than 350 students',
                'max_students'        => 349,
                'monthly_price_cents' => 2500,
                'annual_price_cents'  => 25000,
                'annual_discount_pct' => 17.00,
                'currency'            => 'USD',
                'is_active'           => 1,
                'sort_order'          => 2,
            ],
            [
                'id'                  => 'enterprise',
                'name'                => 'Enterprise',
                'description'         => 'For schools with 350 or more students — unlimited enrolment',
                'max_students'        => null,
                'monthly_price_cents' => 4000,
                'annual_price_cents'  => 40000,
                'annual_discount_pct' => 17.00,
                'currency'            => 'USD',
                'is_active'           => 1,
                'sort_order'          => 3,
            ],
        ];

        // Deactivate any legacy free plan if it still exists
        if ($this->db->table('subscription_plans')->where('id', 'free')->countAllResults() > 0) {
            $this->db->table('subscription_plans')
                ->where('id', 'free')
                ->update(['is_active' => 0, 'updated_at' => $now]);
            echo "  [ok]   Deactivated legacy 'free' plan\n";
        }

        $inserted = 0;
        $updated  = 0;
        foreach ($plans as $plan) {
            $exists = $this->db->table('subscription_plans')
                ->where('id', $plan['id'])
                ->countAllResults();

            if ($exists === 0) {
                $this->db->table('subscription_plans')->insert(
                    array_merge($plan, ['created_at' => $now, 'updated_at' => $now])
                );
                $inserted++;
            } else {
                $this->db->table('subscription_plans')
                    ->where('id', $plan['id'])
                    ->update([
                        'name'                => $plan['name'],
                        'description'         => $plan['description'],
                        'max_students'        => $plan['max_students'],
                        'monthly_price_cents' => $plan['monthly_price_cents'],
                        'annual_price_cents'  => $plan['annual_price_cents'],
                        'annual_discount_pct' => $plan['annual_discount_pct'],
                        'is_active'           => 1,
                        'sort_order'          => $plan['sort_order'],
                        'updated_at'          => $now,
                    ]);
                $updated++;
            }
        }

        echo "  [ok]   Subscription plans: {$inserted} created, {$updated} refreshed\n";
        echo "         Starter $15/mo · Growth $25/mo · Enterprise $40/mo (17% annual discount)\n";
    }
}
