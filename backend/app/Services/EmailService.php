<?php

namespace App\Services;

use App\Libraries\FrontendUrl;
use App\Models\PlatformSetting;
use Config\Services;

class EmailService
{
    /**
     * Hardcoded platform display name used across all outgoing email copy.
     */
    public const PLATFORM_NAME = 'School Ledger';

    private string $appUrl;
    private string $logoUrl;
    private ?string $supportEmail = null;

    public function __construct()
    {
        // All links in emails must resolve to the public frontend (SITE_URL).
        $this->appUrl  = FrontendUrl::base();
        $this->logoUrl = base_url('/assets/logo.jpg');
    }

    /**
     * Resolve the configured platform support email. Used as the Reply-To on
     * every outgoing message so replies reach the support inbox.
     */
    private function supportEmail(): ?string
    {
        if ($this->supportEmail !== null) {
            return $this->supportEmail ?: null;
        }

        $email = '';
        try {
            $value = (new PlatformSetting())->get('support_email');
            if (is_string($value)) {
                $email = trim($value);
            }
        } catch (\Throwable $e) {
            $email = '';
        }

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $email = (string) env('email.supportEmail', '');
        }

        $this->supportEmail = $email;
        return $email ?: null;
    }

    public function sendPasswordReset(string $to, string $recipientName, string $recipientEmail, string $resetLink): void
    {
        $subject = 'Reset Your ' . self::PLATFORM_NAME . ' Password';
        $body    = $this->render('emails/password_reset', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $recipientEmail,
            'reset_link'      => $resetLink,
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $this->send($to, $subject, $body);
    }

    public function sendInvitation(string $to, string $recipientName, string $recipientEmail, string $inviteLink): void
    {
        $subject = "You're invited to " . self::PLATFORM_NAME;
        $body    = $this->render('emails/user_invitation', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $recipientEmail,
            'invite_link'     => $inviteLink,
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $this->send($to, $subject, $body);
    }

    public function sendWelcome(string $to, string $recipientName, string $recipientEmail, string $schoolName, string $tempPassword): void
    {
        $subject = 'Welcome to ' . self::PLATFORM_NAME . ' — Your Account is Ready';
        $body    = $this->render('emails/welcome', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $recipientEmail,
            'school_name'     => $schoolName,
            'temp_password'   => $tempPassword,
            'login_url'       => $this->appUrl,
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $this->send($to, $subject, $body);
    }

    public function sendSubscriptionExpiry(
        string $to,
        string $recipientName,
        string $recipientEmail,
        string $schoolName,
        string $planName,
        string $expiryDate,
        int    $daysRemaining
    ): void {
        $dayWord = $daysRemaining === 1 ? 'day' : 'days';
        $subject = "Your " . self::PLATFORM_NAME . " subscription expires in {$daysRemaining} {$dayWord}";
        $body    = $this->render('emails/subscription_expiry', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $recipientEmail,
            'school_name'     => $schoolName,
            'plan_name'       => $planName,
            'expiry_date'     => $expiryDate,
            'days_remaining'  => $daysRemaining,
            'renewal_url'     => $this->appUrl . '/billing',
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $this->send($to, $subject, $body);
    }

    public function sendSubscriptionConfirmation(
        string $to,
        string $recipientName,
        string $recipientEmail,
        string $schoolName,
        string $planName,
        string $billingCycle,
        int    $amountCents,
        string $currency,
        string $activatedAt,
        string $expiresAt,
        string $invoiceNumber
    ): void {
        $subject = "Subscription Confirmed — {$planName} Plan";
        $body    = $this->render('emails/subscription_confirmation', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $recipientEmail,
            'school_name'     => $schoolName,
            'plan_name'       => $planName,
            'billing_cycle'   => $billingCycle,
            'amount_cents'    => $amountCents,
            'currency'        => $currency,
            'activated_at'    => $activatedAt,
            'expires_at'      => $expiresAt,
            'invoice_number'  => $invoiceNumber,
            'billing_url'     => $this->appUrl . '/billing',
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $this->send($to, $subject, $body);
    }

    public function sendChargesSummary(
        string $to,
        string $recipientName,
        string $recipientEmail,
        string $schoolName,
        string $termId,
        int    $generatedCount,
        float  $totalAmount,
        int    $studentsAffected,
        string $batchId,
        string $currency = 'USD'
    ): void {
        $subject = "Charges Generated: {$generatedCount} charges for {$termId}";
        $body    = $this->render('emails/charges_summary', [
            'recipient_name'   => $recipientName,
            'recipient_email'  => $recipientEmail,
            'school_name'      => $schoolName,
            'term_id'          => $termId,
            'generated_count'  => $generatedCount,
            'total_amount'     => $totalAmount,
            'students_affected'=> $studentsAffected,
            'batch_id'         => $batchId,
            'currency'         => $currency,
            'generated_at'     => date('d M Y, H:i'),
            'ledger_url'       => $this->appUrl . '/charges',
            'app_url'          => $this->appUrl,
            'logo_url'         => $this->logoUrl,
        ]);

        $this->send($to, $subject, $body);
    }

    public function sendInvoice(
        string $to,
        string $recipientName,
        string $recipientEmail,
        array  $invoice,
        string $pdfBytes
    ): void {
        $invoiceNumber = $invoice['invoice_number'];
        $subject       = "Invoice {$invoiceNumber} — " . self::PLATFORM_NAME;
        $body          = $this->render('emails/invoice_email', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $recipientEmail,
            'invoice_number'  => $invoiceNumber,
            'school_name'     => $invoice['school_name'],
            'plan_name'       => $invoice['plan_name'],
            'billing_cycle'   => $invoice['billing_cycle'],
            'amount_cents'    => (int) $invoice['amount_cents'],
            'currency'        => $invoice['currency'],
            'issued_at'       => date('d M Y', strtotime($invoice['issued_at'])),
            'billing_url'     => $this->appUrl . '/billing',
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $tmpPath = tempnam(sys_get_temp_dir(), 'sl_inv_') . '.pdf';
        file_put_contents($tmpPath, $pdfBytes);

        try {
            $this->sendWithAttachment($to, $subject, $body, $tmpPath, "{$invoiceNumber}.pdf", 'application/pdf');
        } finally {
            if (is_file($tmpPath)) {
                unlink($tmpPath);
            }
        }
    }

    public function sendDeletionRequestConfirmation(
        string $to,
        string $recipientName,
        string $schoolName,
        string $expiresAt
    ): void {
        $subject = 'Account Deletion Request Received — ' . self::PLATFORM_NAME;
        $body    = $this->render('emails/deletion_request_confirmation', [
            'recipient_name'      => $recipientName,
            'recipient_email'     => $to,
            'school_name'         => $schoolName,
            'expires_at_formatted' => date('F j, Y', strtotime($expiresAt)),
            'settings_url'        => $this->appUrl . '/settings/account',
            'app_url'             => $this->appUrl,
            'logo_url'            => $this->logoUrl,
        ]);

        $this->send($to, $subject, $body);
    }

    public function sendStudentLimitReached(
        string $to,
        string $recipientName,
        string $recipientEmail,
        string $schoolName,
        string $planName,
        int    $maxStudents,
        int    $currentCount
    ): void {
        $subject = "Action Required: Student Limit Reached — {$schoolName}";
        $body    = $this->render('emails/student_limit_reached', [
            'recipient_name'  => $recipientName,
            'recipient_email' => $recipientEmail,
            'school_name'     => $schoolName,
            'plan_name'       => $planName,
            'max_students'    => $maxStudents,
            'current_count'   => $currentCount,
            'billing_url'     => $this->appUrl . '/billing',
            'app_url'         => $this->appUrl,
            'logo_url'        => $this->logoUrl,
        ]);

        $this->send($to, $subject, $body);
    }

    public function sendDemoRequestNotification(
        string $schoolName,
        string $contactEmail,
        string $schoolAddress,
        int    $estimatedStudents
    ): void {
        $notifyEmail = (string) env('email.notifyEmail', '');
        if ($notifyEmail === '' || !filter_var($notifyEmail, FILTER_VALIDATE_EMAIL)) {
            $notifyEmail = $this->supportEmail();
        }
        if ($notifyEmail === null || $notifyEmail === '') {
            return;
        }

        $platformAdminUrl = (string) env('PLATFORM_URL', base_url('/platform/demo-requests'));

        $subject = "New Demo Request: {$schoolName}";
        $body    = $this->render('emails/demo_request_notification', [
            'school_name'        => $schoolName,
            'contact_email'      => $contactEmail,
            'school_address'     => $schoolAddress,
            'estimated_students' => $estimatedStudents,
            'submitted_at'       => date('d M Y, H:i'),
            'admin_url'          => $platformAdminUrl,
        ]);

        $this->send($notifyEmail, $subject, $body);
    }

    public function sendRaw(string $to, string $subject, string $htmlBody): void
    {
        $this->send($to, $subject, $htmlBody);
    }

    private function send(string $to, string $subject, string $htmlBody): void
    {
        $email = Services::email();
        $email->initialize(['mailType' => 'html']);

        $email->setFrom(
            env('email.fromEmail', 'noreply@schoolledger.com'),
            env('email.fromName',  self::PLATFORM_NAME)
        );
        $this->applyReplyTo($email);
        $email->setTo($to);
        $email->setSubject($subject);
        $email->setMessage($htmlBody);

        if (!$email->send()) {
            throw new \RuntimeException('Email failed to send: ' . $email->printDebugger(['headers']));
        }
    }

    private function sendWithAttachment(
        string $to,
        string $subject,
        string $htmlBody,
        string $attachmentPath,
        string $attachmentName,
        string $mime
    ): void {
        $email = Services::email();
        $email->initialize(['mailType' => 'html']);

        $email->setFrom(
            env('email.fromEmail', 'noreply@schoolledger.com'),
            env('email.fromName',  self::PLATFORM_NAME)
        );
        $this->applyReplyTo($email);
        $email->setTo($to);
        $email->setSubject($subject);
        $email->setMessage($htmlBody);
        $email->attach($attachmentPath, 'attachment', $attachmentName, $mime);

        if (!$email->send()) {
            throw new \RuntimeException('Email failed to send: ' . $email->printDebugger(['headers']));
        }
    }

    /**
     * Route replies to the configured support inbox when one is available.
     */
    private function applyReplyTo($email): void
    {
        $support = $this->supportEmail();
        if ($support !== null) {
            $email->setReplyTo($support, self::PLATFORM_NAME . ' Support');
        }
    }

    /**
     * Render an email template, injecting shared branding/contact variables so
     * every template links to SITE_URL and references the configured support
     * email and platform name consistently.
     */
    private function render(string $template, array $data): string
    {
        return view($template, array_merge([
            'app_url'       => $this->appUrl,
            'logo_url'      => $this->logoUrl,
            'platform_name' => self::PLATFORM_NAME,
            'support_email' => $this->supportEmail() ?? env('email.fromEmail', 'support@schoolledger.com'),
        ], $data));
    }
}
