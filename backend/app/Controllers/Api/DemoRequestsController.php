<?php

namespace App\Controllers\Api;

use App\Models\DemoRequestModel;
use App\Services\EmailService;

/**
 * Public (unauthenticated) endpoint for landing-page demo form submissions.
 *
 * POST /api/demo-requests
 */
class DemoRequestsController extends BaseApiController
{
    public function __construct()
    {
        $this->demoModel = new DemoRequestModel();
    }

    public function store(): \CodeIgniter\HTTP\ResponseInterface
    {
        $body = $this->getRequestBody();

        $schoolName         = trim((string) ($body['school_name']         ?? ''));
        $email              = strtolower(trim((string) ($body['email']    ?? '')));
        $schoolAddress      = trim((string) ($body['school_address']      ?? ''));
        $estimatedStudents  = (int) ($body['estimated_students']          ?? 0);

        $errors = [];

        if ($schoolName === '' || strlen($schoolName) > 255) {
            $errors['school_name'] = 'School name is required and must be 255 characters or fewer.';
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'A valid email address is required.';
        }
        if ($schoolAddress === '' || strlen($schoolAddress) < 5 || strlen($schoolAddress) > 500) {
            $errors['school_address'] = 'School address must be between 5 and 500 characters.';
        }
        if ($estimatedStudents < 1) {
            $errors['estimated_students'] = 'Estimated number of students must be at least 1.';
        }

        if (!empty($errors)) {
            return $this->error('Validation failed.', 422, $errors);
        }

        // Simple rate-limit: max 3 submissions per email per 24 hours
        $recentCount = $this->demoModel
            ->where('email', $email)
            ->where('created_at >=', date('Y-m-d H:i:s', strtotime('-24 hours')))
            ->countAllResults();

        if ($recentCount >= 3) {
            return $this->error('Too many demo requests from this email. Please try again tomorrow.', 429);
        }

        $record = $this->demoModel->createRequest([
            'school_name'        => $schoolName,
            'email'              => $email,
            'school_address'     => $schoolAddress,
            'estimated_students' => $estimatedStudents,
            'status'             => 'new',
        ]);

        try {
            (new EmailService())->sendDemoRequestNotification(
                $schoolName,
                $email,
                $schoolAddress,
                $estimatedStudents
            );
        } catch (\Throwable $e) {
            log_message('error', '[DemoRequestsController] Notification email failed: ' . $e->getMessage());
        }

        return $this->created($record, 'Demo request submitted successfully. We will be in touch within 24 hours.');
    }
}
