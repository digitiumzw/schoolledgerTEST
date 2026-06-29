<?php

namespace App\Filters;

use App\Libraries\RateLimiter;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * RateLimiterFilter — CI4 before/after filter that enforces token-bucket rate limits.
 *
 * Thresholds (from data-model.md §2 and tasks.md T027):
 *   Unauthenticated (IP-keyed):  60 requests/minute  → 1 token/second refill
 *   Authenticated (user-keyed): 120 requests/minute  → 2 tokens/second refill
 *
 * On excess: HTTP 429 JSON with Retry-After and X-RateLimit-* headers.
 * On success: X-RateLimit-* headers appended in after().
 *
 * Bucket key format:
 *   rl:ip:{ip}:{routeHash}     (unauthenticated)
 *   rl:user:{userId}:{routeHash} (authenticated)
 */
class RateLimiterFilter implements FilterInterface
{
    private static ?array $lastResult   = null;
    private static int    $lastCapacity = 0;

    public function before(RequestInterface $request, $arguments = null)
    {
        $userId   = $this->extractUserId($request);
        $ipAddress = $request->getIPAddress();
        $routeHash = substr(md5($request->getUri()->getPath()), 0, 8);

        $unauthLimit = (int) (getenv('RATE_LIMITER_UNAUTHENTICATED_LIMIT') ?: 60);
        $authLimit   = (int) (getenv('RATE_LIMITER_AUTHENTICATED_LIMIT')   ?: 120);

        if ($userId !== null) {
            $bucketKey  = "rl:user:{$userId}:{$routeHash}";
            $capacity   = $authLimit;
        } else {
            $bucketKey  = "rl:ip:{$ipAddress}:{$routeHash}";
            $capacity   = $unauthLimit;
        }

        $refillRate = (int) max(1, (int) ceil($capacity / 60));
        $limiter    = new RateLimiter();
        $result     = $limiter->consume($bucketKey, $capacity, $refillRate);

        self::$lastResult   = $result;
        self::$lastCapacity = $capacity;

        if (!$result['allowed']) {
            $response = service('response');
            $response
                ->setStatusCode(429)
                ->setContentType('application/json')
                ->setHeader('X-RateLimit-Limit',     (string) $capacity)
                ->setHeader('X-RateLimit-Remaining', '0')
                ->setHeader('Retry-After',            (string) $result['retryAfter'])
                ->setBody((string) json_encode([
                    'status'  => false,
                    'message' => 'Too many requests. Please slow down.',
                    'error'   => [
                        'code'       => 429,
                        'retryAfter' => $result['retryAfter'],
                    ],
                ]));

            return $response;
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        if (self::$lastResult !== null) {
            $response->setHeader('X-RateLimit-Limit',     (string) self::$lastCapacity);
            $response->setHeader('X-RateLimit-Remaining', (string) self::$lastResult['remaining']);
        }
    }

    private function extractUserId(RequestInterface $request): ?string
    {
        try {
            $authHeader = $request->getHeaderLine('Authorization');
            if (empty($authHeader) || strpos($authHeader, 'Bearer ') !== 0) {
                return null;
            }

            $parts = explode('.', substr($authHeader, 7));
            if (count($parts) !== 3) {
                return null;
            }

            $padded  = str_pad(strtr($parts[1], '-_', '+/'), (int) ceil(strlen($parts[1]) / 4) * 4, '=');
            $payload = json_decode(base64_decode($padded), true);

            return isset($payload['data']['id'])
                ? (string) $payload['data']['id']
                : (isset($payload['sub']) ? (string) $payload['sub'] : null);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
