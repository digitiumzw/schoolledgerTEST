<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use App\Libraries\PlatformJWTHandler;
use App\Models\PlatformUser;
use Exception;

class PlatformJWTAuthFilter implements FilterInterface
{
    private const PUBLIC_PATHS = [
        'api/platform/auth/login',
        'api/platform/auth/forgot-password',
        'api/platform/auth/reset-password',
        'api/platform/auth/accept-invite',
    ];

    public function before(RequestInterface $request, $arguments = null)
    {
        // Let CORS preflight requests through without authentication so the
        // browser receives the Access-Control headers it needs.
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            return $this->addCorsHeaders(service('response'))->setStatusCode(200);
        }

        $uri = $request->getUri()->getPath();

        if ($this->matchesAnyPath($uri, self::PUBLIC_PATHS)) {
            return $request;
        }

        $authHeader = $request->getHeaderLine('Authorization');

        if (empty($authHeader)) {
            return $this->unauthorised('No authentication token provided.');
        }

        if (!preg_match('/^Bearer\s(\S+)$/i', trim($authHeader), $matches)) {
            return $this->unauthorised('Invalid authorization header format. Use: Bearer <token>');
        }

        $token = $matches[1];

        try {
            $handler   = new PlatformJWTHandler();
            $tokenData = $handler->validateToken($token);

            if (!isset($tokenData->scope) || $tokenData->scope !== 'platform') {
                return $this->unauthorised('Invalid token scope. Platform access required.');
            }

            // Re-fetch live role + status from DB on every request — JWT is identity only.
            $userModel = new PlatformUser();
            $live = $userModel->find((int) ($tokenData->id ?? 0));

            if (!$live) {
                return $this->unauthorised('Account no longer exists. Please sign in again.');
            }

            if (($live['status'] ?? 'Active') === 'Deactivated') {
                return $this->forbidden403('This account has been deactivated.');
            }

            // Overwrite token claims with live DB values
            $tokenData->platform_role = $live['platform_role'];
            $tokenData->status        = $live['status'] ?? 'Active';
            $tokenData->name          = $live['name'];
            $tokenData->email         = $live['email'];

            $request->platformUser = $tokenData;

            return $request;

        } catch (Exception $e) {
            log_message('info', '[PlatformJWTAuthFilter] Token validation failed: ' . $e->getMessage());

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

    /**
     * Returns true when the request URI exactly matches one of the listed
     * paths or is a sub-path of it (e.g. `account` matches `account/password`).
     * Uses path-segment boundaries so `auth/login` does NOT match `auth/login-history`.
     */
    private function matchesAnyPath(string $uri, array $paths): bool
    {
        // Normalise: ensure leading + trailing slash so segment boundaries are unambiguous.
        $haystack = '/' . trim($uri, '/') . '/';
        foreach ($paths as $p) {
            $needle = '/' . trim($p, '/') . '/';
            // Match the path as a complete segment, optionally followed by sub-segments.
            // Accepts both exact match and any sub-path (e.g. /account/ matches /account/password/).
            if (str_contains($haystack, $needle)) {
                return true;
            }
        }
        return false;
    }

    private function unauthorised(string $message): ResponseInterface
    {
        return $this->addCorsHeaders(service('response'))
            ->setStatusCode(401)
            ->setJSON(['status' => false, 'message' => $message]);
    }

    private function forbidden403(string $message): ResponseInterface
    {
        return $this->addCorsHeaders(service('response'))
            ->setStatusCode(403)
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
