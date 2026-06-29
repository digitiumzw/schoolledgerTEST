<?php

namespace App\Services;

use App\Models\SchoolSubscriptionModel;
use App\Models\SubscriptionPlanModel;
use App\Models\TenantModel;
use App\Models\UserModel;

class PlanExpirationNotificationService
{
    private SchoolSubscriptionModel $subscriptionModel;
    private SubscriptionPlanModel $planModel;
    private TenantModel $tenantModel;
    private UserModel $userModel;
    private EmailService $emailService;

    public function __construct()
    {
        $this->subscriptionModel = new SchoolSubscriptionModel();
        $this->planModel         = new SubscriptionPlanModel();
        $this->tenantModel       = new TenantModel();
        $this->userModel         = new UserModel();
        $this->emailService      = new EmailService();
    }

    /**
     * Check for subscriptions expiring within the specified days and send notifications.
     *
     * @param int $days Number of days threshold (default: 7)
     * @return array Result with counts of processed and notified subscriptions
     */
    public function processExpiringSubscriptions(int $days = 7): array
    {
        $expiring = $this->subscriptionModel->findExpiringSubscriptions($days);
        
        $processed = 0;
        $notified = 0;
        $errors = [];

        foreach ($expiring as $subscription) {
            $processed++;
            
            try {
                $this->sendExpirationNotification($subscription);
                $notified++;
            } catch (\Exception $e) {
                $errors[] = [
                    'subscription_id' => $subscription['id'],
                    'error' => $e->getMessage(),
                ];
                log_message('error', "Failed to send expiration notification for subscription {$subscription['id']}: " . $e->getMessage());
            }
        }

        return [
            'processed' => $processed,
            'notified' => $notified,
            'errors' => $errors,
        ];
    }

    /**
     * Send expiration notification for a subscription.
     *
     * @param array $subscription The subscription record
     * @throws \Exception If notification fails
     */
    private function sendExpirationNotification(array $subscription): void
    {
        $tenant = $this->tenantModel->find($subscription['tenant_id']);
        $plan = $this->planModel->find($subscription['plan_id']);
        
        if (!$tenant || !$plan) {
            throw new \Exception('Tenant or plan not found');
        }

        // Get admin users for the tenant
        $users = $this->userModel->getByTenant($subscription['tenant_id']);
        $adminUsers = array_filter($users, fn($u) => in_array($u['role'], ['admin', 'super_admin']));
        
        if (empty($adminUsers)) {
            // If no admin users, notify all users
            $adminUsers = $users;
        }

        // Format expiration date
        $expiresAt = new \DateTime($subscription['expires_at']);
        $now = new \DateTime();
        $daysRemaining = (int) $now->diff($expiresAt)->format('%r%a');
        $daysRemaining = abs($daysRemaining); // Ensure positive number

        $planName        = $plan['name'] ?? 'Your Plan';
        $formattedExpiry = $expiresAt->format('F j, Y');

        // Send to each admin user
        foreach ($adminUsers as $user) {
            $this->emailService->sendSubscriptionExpiry(
                $user['email'],
                $user['name'] ?? 'Administrator',
                $user['email'],
                $tenant['name'] ?? 'your school',
                $planName,
                $formattedExpiry,
                $daysRemaining
            );
        }

        // Mark as notified
        $nowStr = date('Y-m-d H:i:s');
        $this->subscriptionModel->update($subscription['id'], [
            'expiration_notification_sent_at' => $nowStr,
            'updated_at' => $nowStr,
        ]);

        log_message('info', "Expiration notification sent for subscription {$subscription['id']} to tenant {$subscription['tenant_id']}");
    }

}
