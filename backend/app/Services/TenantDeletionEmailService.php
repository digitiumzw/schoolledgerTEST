<?php

namespace App\Services;

class TenantDeletionEmailService
{
    private EmailService $emailService;
    private string $appUrl;
    private string $logoUrl;

    public function __construct()
    {
        $this->emailService = new EmailService();
        $this->appUrl       = \App\Libraries\FrontendUrl::base();
        $this->logoUrl      = $this->appUrl . '/assets/logo.jpg';
    }

    /**
     * Send Day 4 reminder email (3 days after request, 4 days remaining)
     *
     * @param string $to Recipient email
     * @param string $recipientName Recipient name
     * @param string $tenantName Tenant/school name
     * @param int $remainingDays Days until deletion
     */
    public function sendDay4Reminder(string $to, string $recipientName, string $tenantName, int $remainingDays): void
    {
        $subject = "Account Deletion Reminder — {$remainingDays} Days Remaining";
        $body    = view('emails/deletion_reminder_day4', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $to,
            'school_name'     => $tenantName,
            'remaining_days'  => $remainingDays,
            'settings_url'    => $this->appUrl . '/settings/account',
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $this->emailService->sendRaw($to, $subject, $body);
    }

    /**
     * Send Day 7 final reminder email (6 days after request, 1 day remaining)
     *
     * @param string $to Recipient email
     * @param string $recipientName Recipient name
     * @param string $tenantName Tenant/school name
     * @param int $remainingDays Days until deletion
     */
    public function sendDay7Reminder(string $to, string $recipientName, string $tenantName, int $remainingDays): void
    {
        $subject = 'FINAL REMINDER: Account Deletion Tomorrow — SchoolLedger';
        $body    = view('emails/deletion_reminder_day7', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $to,
            'school_name'     => $tenantName,
            'remaining_days'  => $remainingDays,
            'settings_url'    => $this->appUrl . '/settings/account',
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $this->emailService->sendRaw($to, $subject, $body);
    }

    /**
     * Get days remaining message for email
     *
     * @param int $days Number of days
     * @return string Formatted message
     */
    public function getDaysRemainingMessage(int $days): string
    {
        $dayWord = $days === 1 ? 'day' : 'days';

        return match ($days) {
            7 => 'Your account is scheduled for deletion in 7 days.',
            4 => 'Your account will be deleted in 4 days.',
            1 => 'Your account will be permanently deleted TOMORROW.',
            0 => 'Your account is being deleted TODAY.',
            default => "Your account is scheduled for deletion in {$days} {$dayWord}.",
        };
    }
}
