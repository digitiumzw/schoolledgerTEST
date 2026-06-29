<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use App\Libraries\JWTHandler;
use App\Models\PlatformSetting;
use Exception;

class JWTAuthFilter implements FilterInterface
{
    /**
     * URI fragments that are allowed without a JWT token.
     * Matched against the full URI path so they must be exact path segments.
     */
    private const PUBLIC_PATHS = [
        'auth/login',
        'auth/register',
        'auth/forgot-password',
        'auth/reset-password',
        'auth/accept-invite',
        'kiosk/status',
        'kiosk/action',
        'kiosk/student-attendance',
        'kiosk/driver',
        'receipts/',
        'demo-requests',
        'maintenance-status',
    ];

    public function before(RequestInterface $request, $arguments = null)
    {
        $uri = $request->getUri()->getPath();

        // Pass through public endpoints
        foreach (self::PUBLIC_PATHS as $publicPath) {
            if (str_contains($uri, $publicPath)) {
                return $request;
            }
        }

        $authHeader = $request->getHeaderLine('Authorization');

        if (empty($authHeader)) {
            return $this->unauthorised('No authentication token provided.');
        }

        // Extract Bearer token
        if (!preg_match('/^Bearer\s(\S+)$/i', trim($authHeader), $matches)) {
            return $this->unauthorised('Invalid authorization header format. Use: Bearer <token>');
        }

        $token = $matches[1];

        try {
            $jwtHandler = new JWTHandler();
            $userData   = $jwtHandler->validateToken($token);

            // Attach decoded user to the request so controllers can read it
            $request->user = $userData;

            // ── Maintenance mode check ────────────────────────────────────
            // If maintenance mode is enabled, block ALL tenant users.
            // Only super_admin bypasses the check.
            $settingModel = new PlatformSetting();
            $maintenanceMode = (bool) $settingModel->get('maintenance_mode');

            if ($maintenanceMode) {
                $role = $userData->role ?? null;
                if ($role !== 'super_admin') {
                    $headline = (string) $settingModel->get('maintenance_headline');
                    $message  = (string) $settingModel->get('maintenance_message');
                    if ($headline === '') {
                        $headline = 'Platform Under Maintenance';
                    }
                    if ($message === '') {
                        $message = 'The platform is currently under maintenance. Service will be restored shortly.';
                    }

                    log_message('info', '[JWTAuthFilter] Maintenance mode active — blocking tenant user (role: ' . ($role ?? 'unknown') . ')');

                    return $this->addCorsHeaders(service('response'))
                        ->setStatusCode(503)
                        ->setJSON([
                            'status'  => false,
                            'message' => $headline,
                            'data'    => [
                                'maintenance_mode' => true,
                                'headline'         => $headline,
                                'message'          => $message,
                            ],
                        ]);
                }
            }

            return $request;

        } catch (Exception $e) {
            // Log the real reason but return a generic message to the client
            log_message('info', '[JWTAuthFilter] Token validation failed: ' . $e->getMessage());

            $message = str_contains($e->getMessage(), 'Expired')
                ? 'Your session has expired. Please sign in again.'
                : 'Invalid authentication token. Please sign in again.';

            return $this->unauthorised($message);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null): ResponseInterface
    {
        return $this->addCorsHeaders($response);
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────

    private function unauthorised(string $message): ResponseInterface
    {
        return $this->addCorsHeaders(service('response'))
            ->setStatusCode(401)
            ->setJSON(['status' => false, 'message' => $message]);
    }

    private function addCorsHeaders(ResponseInterface $response): ResponseInterface
    {
        return $response
            ->setHeader('Access-Control-Allow-Origin', '*')
            ->setHeader('Access-Control-Allow-Headers', 'X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method, Authorization')
            ->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    }
}
